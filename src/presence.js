// Live-cursor presence: who is in a room, where their cursor is, and
// whether they are still there. Pure and time-injectable — the room
// layer owns broadcasting, the server owns the clock in production,
// and tests drive time with a fake `now`.
//
// A peer is identified by a client-chosen id (a UUID per page load).
// Names are display-only, trimmed, and default to "Guest". Colors come
// from a fixed palette in join order so a peer keeps one color for the
// whole session. A peer that stops sending cursor updates for longer
// than `staleAfterMs` is pruned as gone (tab closed, network lost) —
// the client also sends an explicit leave on unload when it can.

export const CURSOR_COLORS = [
  "#d62728", "#1f77b4", "#2ca02c", "#ff7f0e",
  "#9467bd", "#17becf", "#e377c2", "#8c564b",
];

export const DEFAULT_STALE_AFTER_MS = 15_000;

export function isValidPeerId(id) {
  return typeof id === "string" && id.length >= 1 && id.length <= 128;
}

export function normalizeName(name) {
  if (typeof name !== "string") return "Guest";
  const trimmed = name.trim();
  return trimmed === "" ? "Guest" : trimmed;
}

export function isValidName(name) {
  // A blank name is valid — it normalizes to "Guest". Only overlong or
  // non-string names are rejected.
  return typeof name === "string" && name.trim().length <= 32;
}

export function isValidCoordinate(v) {
  return typeof v === "number" && Number.isFinite(v);
}

export function createPresence({ staleAfterMs = DEFAULT_STALE_AFTER_MS, now = () => Date.now() } = {}) {
  const peers = new Map();
  let nextColor = 0;

  function snapshot(peer) {
    return { peerId: peer.peerId, name: peer.name, color: peer.color, x: peer.x, y: peer.y };
  }

  function list() {
    return [...peers.values()].map(snapshot);
  }

  // Insert or move a peer. A move from an unknown peer joins it, because
  // a client sends its first cursor update without a separate handshake.
  // Returns { peer, joined } — `joined` tells the caller whether to
  // broadcast a join event in addition to the cursor event.
  function move(peerId, name, x, y) {
    if (!isValidPeerId(peerId)) throw new Error("invalid peer id");
    if (!isValidName(name)) throw new Error("invalid name: 1-32 characters");
    if (!isValidCoordinate(x) || !isValidCoordinate(y)) throw new Error("invalid cursor position");
    let peer = peers.get(peerId);
    const joined = peer === undefined;
    if (joined) {
      peer = { peerId, name: normalizeName(name), color: CURSOR_COLORS[nextColor++ % CURSOR_COLORS.length], x, y, lastSeen: now() };
      peers.set(peerId, peer);
    } else {
      peer.name = normalizeName(name);
      peer.x = x;
      peer.y = y;
      peer.lastSeen = now();
    }
    return { peer: snapshot(peer), joined };
  }

  function leave(peerId) {
    return peers.delete(peerId);
  }

  // Drop peers silent for longer than staleAfterMs; returns their
  // snapshots so the caller can broadcast one leave event each.
  function prune(at = now()) {
    const gone = [];
    for (const peer of [...peers.values()]) {
      if (at - peer.lastSeen > staleAfterMs) {
        peers.delete(peer.peerId);
        gone.push(snapshot(peer));
      }
    }
    return gone;
  }

  return { move, leave, prune, list, has: (id) => peers.has(id) };
}
