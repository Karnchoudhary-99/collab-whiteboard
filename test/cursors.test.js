import test from "node:test";
import assert from "node:assert/strict";
import { drawCursor, drawCursors } from "../public/cursors.js";

// Minimal 2D-context stand-in recording every call in order.
function mockCtx() {
  const calls = [];
  return {
    calls,
    canvas: { width: 800, height: 600 },
    set fillStyle(v) { calls.push(["fillStyle", v]); },
    set strokeStyle(v) { calls.push(["strokeStyle", v]); },
    set font(v) { calls.push(["font", v]); },
    beginPath() { calls.push(["beginPath"]); },
    moveTo(x, y) { calls.push(["moveTo", x, y]); },
    lineTo(x, y) { calls.push(["lineTo", x, y]); },
    closePath() { calls.push(["closePath"]); },
    fill() { calls.push(["fill"]); },
    fillRect(x, y, w, h) { calls.push(["fillRect", x, y, w, h]); },
    fillText(text, x, y) { calls.push(["fillText", text, x, y]); },
    measureText(text) { return { width: text.length * 7 }; },
  };
}

test("drawCursor draws an arrow at the peer position with its color and name", () => {
  const ctx = mockCtx();
  drawCursor(ctx, { peerId: "p1", name: "Ana", color: "#d62728", x: 100, y: 50 });
  assert.ok(ctx.calls.some(([n, x, y]) => n === "moveTo" && x === 100 && y === 50)); // arrow tip at cursor
  assert.ok(ctx.calls.some(([n, v]) => n === "fillStyle" && v === "#d62728"));
  assert.ok(ctx.calls.some(([n, text]) => n === "fillText" && text === "Ana"));
});

test("drawCursors draws every peer and nothing for an empty list", () => {
  const ctx = mockCtx();
  drawCursors(ctx, []);
  assert.deepEqual(ctx.calls, []);
  drawCursors(ctx, [
    { peerId: "p1", name: "Ana", color: "#d62728", x: 0, y: 0 },
    { peerId: "p2", name: "Bo", color: "#1f77b4", x: 10, y: 10 },
  ]);
  const labels = ctx.calls.filter(([n]) => n === "fillText").map(([, text]) => text);
  assert.deepEqual(labels, ["Ana", "Bo"]);
});
