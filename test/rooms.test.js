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
