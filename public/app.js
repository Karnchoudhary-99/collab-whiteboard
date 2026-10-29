// Browser entry point: pointer capture -> board -> canvas render.
// The sync layer (added next) only feeds strokes into the same board +
// redraw path through the hooks below; drawing itself stays local-first.
import { createBoard, addStroke, clearBoard, undoStroke } from "../src/strokes.js";
import { createStrokeCapture } from "../src/pointer.js";
import { drawBoard, drawStroke } from "./render.js";

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const board = createBoard();
const capture = createStrokeCapture({ minDistance: 2 });
const statusEl = document.getElementById("status");

function redraw() {
  drawBoard(ctx, board);
}

// Live preview: committed strokes plus the one still being drawn.
function redrawWithPreview() {
  drawBoard(ctx, board);
  const current = capture.currentStroke?.();
  if (current) drawStroke(ctx, current);
}

function canvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height),
    pressure: e.pressure,
  };
}

// The sync layer replaces these hooks with server-backed versions;
// by default they just mutate the local board.
export const hooks = {
  onLocalStroke(stroke) { addStroke(board, stroke.points, stroke.color, stroke.width); redraw(); },
  onRemoteStroke(stroke) { addStroke(board, stroke.points, stroke.color, stroke.width); redraw(); },
  onUndo() { undoStroke(board); redraw(); },
  onClear() { clearBoard(board); redraw(); },
  onState(strokes) { clearBoard(board); for (const s of strokes) addStroke(board, s.points, s.color, s.width); redraw(); },
};

canvas.addEventListener("pointerdown", (e) => {
  canvas.setPointerCapture(e.pointerId);
  const color = document.getElementById("color").value;
  const width = Number(document.getElementById("width").value);
  capture.pointerDown(canvasPoint(e), color, width);
});

canvas.addEventListener("pointermove", (e) => {
  if (!capture.isDrawing()) return;
  if (capture.pointerMove(canvasPoint(e))) redrawWithPreview();
});

canvas.addEventListener("pointerup", () => {
  const stroke = capture.pointerUp();
  if (stroke) hooks.onLocalStroke(stroke);
});

document.getElementById("undo").addEventListener("click", () => hooks.onUndo());
document.getElementById("clear").addEventListener("click", () => hooks.onClear());

statusEl.textContent = "local mode — start the server for live sync";
redraw();
