import test from "node:test";
import assert from "node:assert/strict";
import { createBoard, addStroke, clearBoard, undoStroke } from "../src/strokes.js";

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

test("undoStroke pops the last stroke, null on an empty board", () => {
  const board = createBoard();
  assert.equal(undoStroke(board), null);
  addStroke(board, [{ x: 0, y: 0 }], "#111111", 2);
  addStroke(board, [{ x: 9, y: 9 }], "#222222", 2);
  const undone = undoStroke(board);
  assert.equal(undone.color, "#222222");
  assert.equal(board.strokes.length, 1);
  assert.equal(board.strokes[0].color, "#111111");
});
