// A whiteboard is an ordered list of strokes; a stroke is an ordered
// list of points plus its colour and width. This module is the shared
// core: the server broadcasts strokes, clients render them, and both
// sides agree on ordering by keeping strokes in insertion order.
export function createBoard() {
  return { strokes: [] };
}

export function addStroke(board, points, color = "#222222", width = 2) {
  if (!Array.isArray(points) || points.length < 1) {
    throw new Error("a stroke needs at least one point");
  }
  for (const p of points) {
    if (typeof p.x !== "number" || typeof p.y !== "number" ||
        !Number.isFinite(p.x) || !Number.isFinite(p.y)) {
      throw new Error("stroke points must have finite numeric x and y");
    }
  }
  const stroke = { points: points.map((p) => ({ x: p.x, y: p.y })), color, width };
  board.strokes.push(stroke);
  return stroke;
}

export function clearBoard(board) {
  board.strokes.length = 0;
}
