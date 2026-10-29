// Room registry: one board per room id, plus a broadcast fan-out.
// Pure and socket-free — the HTTP/SSE server adapts this to requests,
// and tests exercise rooms without ever binding a port.
//
// Events broadcast to subscribers:
//   { type: "stroke", stroke }  a new stroke was added
//   { type: "undo", stroke }    the last stroke was removed (stroke may be null)
//   { type: "clear" }            the board was cleared
import { createBoard, addStroke, clearBoard, undoStroke } from "./strokes.js";

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
      room = {
        id,
        board,
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
      };
      rooms.set(id, room);
    }
    return room;
  }

  return { getOrCreate, has: (id) => rooms.has(id) };
}
