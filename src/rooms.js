// Room registry: one board per room id, plus a broadcast fan-out.
// Pure and socket-free — the HTTP/SSE server adapts this to requests,
// and tests exercise rooms without ever binding a port.
//
// Events broadcast to subscribers:
//   { type: "stroke", stroke }  a new stroke was added
//   { type: "undo", stroke }    the last stroke was removed (stroke may be null)
//   { type: "clear" }            the board was cleared
//   { type: "cursor", peer }    a peer moved (peer is a presence snapshot)
//   { type: "peer-joined", peer }  a peer's first cursor arrived
//   { type: "peer-left", peer }    a peer left or went stale
import { createBoard, addStroke, clearBoard, undoStroke } from "./strokes.js";
import { createPresence } from "./presence.js";

export function isValidRoomId(id) {
  return typeof id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(id);
}

export function createRooms() {
  const rooms = new Map();

  function getOrCreate(id) {
    if (!isValidRoomId(id)) throw new Error(`invalid room id: ${String(id)}`);
    let room = rooms.get(id);
    if (!room) {
      const board = createBoard();
      const listeners = new Set();
      const presence = createPresence();
      room = {
        id,
        board,
        presence,
        seq: 0,
        subscribe(fn) {
          listeners.add(fn);
          return () => listeners.delete(fn);
        },
        broadcast(event) {
          for (const fn of [...listeners]) fn(event);
        },
        addStroke(points, color, width, id = undefined) {
          const stroke = addStroke(board, points, color, width, id ?? `srv-${++room.seq}`);
          room.broadcast({ type: "stroke", stroke });
          return stroke;
        },
        undo() {
          const stroke = undoStroke(board);
          room.broadcast({ type: "undo", stroke });
          return stroke;
        },
        clear() {
          clearBoard(board);
          room.broadcast({ type: "clear" });
        },
        // A cursor update also sweeps stale peers first, so a closed tab
        // disappears as soon as anyone else moves — the server's periodic
        // sweep covers rooms where nobody moves.
        moveCursor(peerId, name, x, y) {
          for (const gone of presence.prune()) room.broadcast({ type: "peer-left", peer: gone });
          const { peer, joined } = presence.move(peerId, name, x, y);
          if (joined) room.broadcast({ type: "peer-joined", peer });
          room.broadcast({ type: "cursor", peer });
          return peer;
        },
        leavePeer(peerId) {
          const peers = presence.list();
          const gone = peers.find((p) => p.peerId === peerId);
          if (!gone) return false;
          presence.leave(peerId);
          room.broadcast({ type: "peer-left", peer: gone });
          return true;
        },
        prunePresence() {
          const gone = presence.prune();
          for (const peer of gone) room.broadcast({ type: "peer-left", peer });
          return gone;
        },
        listPresence() {
          return presence.list();
        },
      };
      rooms.set(id, room);
    }
    return room;
  }

  return { getOrCreate, has: (id) => rooms.has(id), all: () => [...rooms.values()] };
}
