import test from "node:test";
import assert from "node:assert/strict";
import { createPresence, CURSOR_COLORS } from "../src/presence.js";

function clock(start = 1000) {
  let t = start;
  return { now: () => t, advance: (ms) => { t += ms; } };
}

test("presence: first move joins with a palette color, later moves keep it", () => {
  const { now } = clock();
  const presence = createPresence({ now });
  const first = presence.move("peer-1", "Ana", 10, 20);
  assert.equal(first.joined, true);
  assert.equal(first.peer.color, CURSOR_COLORS[0]);
  assert.equal(first.peer.name, "Ana");
  const second = presence.move("peer-1", "Ana", 30, 40);
  assert.equal(second.joined, false);
  assert.equal(second.peer.color, CURSOR_COLORS[0]);
  assert.deepEqual(second.peer, { peerId: "peer-1", name: "Ana", color: CURSOR_COLORS[0], x: 30, y: 40 });
  // Second peer gets the next color; rejoining keeps the original color.
  assert.equal(presence.move("peer-2", "Bo", 0, 0).peer.color, CURSOR_COLORS[1]);
  assert.equal(presence.list().length, 2);
});

test("presence: blank names become Guest, overlong names and bad input rejected", () => {
  const { now } = clock();
  const presence = createPresence({ now });
  assert.equal(presence.move("p", "   ", 1, 1).peer.name, "Guest");
  assert.throws(() => presence.move("p", "x".repeat(33), 1, 1), /invalid name/);
  assert.throws(() => presence.move("", "Ana", 1, 1), /invalid peer id/);
  assert.throws(() => presence.move("p", "Ana", Number.NaN, 1), /invalid cursor position/);
  assert.throws(() => presence.move("p", "Ana", 1, "2"), /invalid cursor position/);
});

test("presence: stale peers prune, fresh peers survive, leave removes", () => {
  const c = clock(0);
  const presence = createPresence({ staleAfterMs: 15_000, now: c.now });
  presence.move("old", "Old", 1, 1);
  c.advance(10_000);
  presence.move("new", "New", 2, 2);
  c.advance(6_000); // old silent 16s, new silent 6s
  const gone = presence.prune();
  assert.deepEqual(gone.map((p) => p.peerId), ["old"]);
  assert.deepEqual(presence.list().map((p) => p.peerId), ["new"]);
  // Boundary: exactly staleAfterMs is still alive (strictly greater prunes).
  c.advance(9_000); // new silent 15s exactly
  assert.deepEqual(presence.prune(), []);
  c.advance(1);
  assert.deepEqual(presence.prune().map((p) => p.peerId), ["new"]);
  presence.move("x", "X", 0, 0);
  assert.equal(presence.leave("x"), true);
  assert.equal(presence.leave("x"), false);
  assert.equal(presence.list().length, 0);
});
