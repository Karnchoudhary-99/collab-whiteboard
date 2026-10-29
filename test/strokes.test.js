import test from "node:test";
import assert from "node:assert/strict";
import { createBoard, addStroke, clearBoard } from "../src/strokes.js";

test("addStroke appends in order and copies points", () => {
  const board = createBoard();
  addStroke(board, [{ x: 0, y: 0 }, { x: 10, y: 10 }], "#ff0000", 3);
  assert.equal(board.strokes.length, 1);
  assert.equal(board.strokes[0].color, "#ff0000");
  assert.deepEqual(board.strokes[0].points, [{ x: 0, y: 0 }, { x: 10, y: 10 }]);
});

test("addStroke rejects empty and non-finite points", () => {
  const board = createBoard();
  assert.throws(() => addStroke(board, []));
  assert.throws(() => addStroke(board, [{ x: 0, y: NaN }]));
});

test("clearBoard empties the board", () => {
  const board = createBoard();
  addStroke(board, [{ x: 1, y: 1 }]);
  clearBoard(board);
  assert.equal(board.strokes.length, 0);
});
