import test from "node:test";
import assert from "node:assert/strict";
import { drawStroke, drawBoard } from "../public/render.js";

// Minimal 2D-context stand-in recording every call in order.
function mockCtx() {
  const calls = [];
  return {
    calls,
    canvas: { width: 800, height: 600 },
    set strokeStyle(v) { calls.push(["strokeStyle", v]); },
    set fillStyle(v) { calls.push(["fillStyle", v]); },
    set lineWidth(v) { calls.push(["lineWidth", v]); },
    set lineCap(v) { calls.push(["lineCap", v]); },
    set lineJoin(v) { calls.push(["lineJoin", v]); },
    beginPath() { calls.push(["beginPath"]); },
    moveTo(x, y) { calls.push(["moveTo", x, y]); },
    lineTo(x, y) { calls.push(["lineTo", x, y]); },
    stroke() { calls.push(["stroke"]); },
    fill() { calls.push(["fill"]); },
    arc(x, y, r) { calls.push(["arc", x, y, r]); },
    clearRect(x, y, w, h) { calls.push(["clearRect", x, y, w, h]); },
  };
}

test("drawStroke draws a polyline with the stroke style", () => {
  const ctx = mockCtx();
  drawStroke(ctx, { points: [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 5 }], color: "#123456", width: 4 });
  assert.ok(ctx.calls.some(([n, v]) => n === "strokeStyle" && v === "#123456"));
  assert.ok(ctx.calls.some(([n, v]) => n === "lineWidth" && v === 4));
  assert.deepEqual(ctx.calls.filter(([n]) => n === "lineTo"), [["lineTo", 10, 10], ["lineTo", 20, 5]]);
  assert.ok(ctx.calls.some(([n]) => n === "stroke"));
});

test("drawStroke renders a single-point stroke as a dot", () => {
  const ctx = mockCtx();
  drawStroke(ctx, { points: [{ x: 7, y: 8 }], color: "#000000", width: 3 });
  assert.ok(ctx.calls.some(([n]) => n === "arc"));
  assert.ok(ctx.calls.some(([n]) => n === "fill"));
  assert.ok(!ctx.calls.some(([n]) => n === "stroke"));
});

test("drawBoard clears then draws strokes in order", () => {
  const ctx = mockCtx();
  drawBoard(ctx, { strokes: [
    { points: [{ x: 0, y: 0 }], color: "#111111", width: 2 },
    { points: [{ x: 1, y: 1 }, { x: 2, y: 2 }], color: "#222222", width: 2 },
  ] });
  assert.deepEqual(ctx.calls[0], ["clearRect", 0, 0, 800, 600]);
  const fills = ctx.calls.filter(([n, v]) => n === "fillStyle").map(([, v]) => v);
  assert.deepEqual(fills, ["#111111", "#222222"]);
});
