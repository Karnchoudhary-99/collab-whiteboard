import test from "node:test";
import assert from "node:assert/strict";
import { createRooms, isValidRoomId } from "../src/rooms.js";

test("isValidRoomId accepts sane ids, rejects the rest", () => {
  assert.equal(isValidRoomId("lobby"), true);
  assert.equal(isValidRoomId("team-1_x"), true);
  assert.equal(isValidRoomId(""), false);
  assert.equal(isValidRoomId("a/b"), false);
  assert.equal(isValidRoomId("a b"), false);
  assert.equal(isValidRoomId("x".repeat(65)), false);
  assert.equal(isValidRoomId(null), false);
});

test("rooms: same id returns the same room, different ids are separate boards", () => {
  const rooms = createRooms();
  const a = rooms.getOrCreate("lobby");
  const b = rooms.getOrCreate("lobby");
  assert.equal(a, b);
  assert.notEqual(a, rooms.getOrCreate("other"));
  assert.equal(rooms.has("lobby"), true);
  assert.equal(rooms.has("missing"), false);
  assert.throws(() => rooms.getOrCreate("../etc"));
});

test("rooms: stroke/undo/clear broadcast events to subscribers in order", () => {
  const rooms = createRooms();
  const room = rooms.getOrCreate("lobby");
  const seen = [];
  const off = room.subscribe((e) => seen.push(e.type));
  room.addStroke([{ x: 0, y: 0 }], "#111111", 2);
  room.undo();
  room.clear();
  off();
  room.addStroke([{ x: 1, y: 1 }]); // after unsubscribe: no event
  assert.deepEqual(seen, ["stroke", "undo", "clear"]);
  assert.equal(room.board.strokes.length, 1);
});

test("rooms: undo event carries the removed stroke", () => {
  const rooms = createRooms();
  const room = rooms.getOrCreate("lobby");
  let event;
  room.subscribe((e) => { event = e; });
  room.addStroke([{ x: 3, y: 3 }], "#222222", 2);
  room.undo();
  assert.equal(event.type, "undo");
  assert.equal(event.stroke.color, "#222222");
});

test("rooms: cursor moves broadcast join then cursor, leave broadcasts peer-left", () => {
  const rooms = createRooms();
  const room = rooms.getOrCreate("lobby");
  const seen = [];
  room.subscribe((e) => seen.push(e));
  room.moveCursor("peer-1", "Ana", 10, 20);
  room.moveCursor("peer-1", "Ana", 11, 21);
  assert.deepEqual(seen.map((e) => e.type), ["peer-joined", "cursor", "cursor"]);
  assert.equal(seen[0].peer.name, "Ana");
  assert.equal(room.listPresence().length, 1);
  assert.equal(room.leavePeer("peer-1"), true);
  assert.equal(room.leavePeer("peer-1"), false);
  assert.equal(seen.at(-1).type, "peer-left");
  assert.equal(room.listPresence().length, 0);
});

test("rooms: presence is per-room and all() lists every room", () => {
  const rooms = createRooms();
  rooms.getOrCreate("a").moveCursor("p", "Ana", 1, 1);
  const b = rooms.getOrCreate("b");
  assert.equal(b.listPresence().length, 0);
  assert.deepEqual(rooms.all().map((r) => r.id).sort(), ["a", "b"]);
});
