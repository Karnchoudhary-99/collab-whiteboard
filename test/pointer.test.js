import test from "node:test";
import assert from "node:assert/strict";
import { createStrokeCapture, widthForPressure, distance } from "../src/pointer.js";

test("widthForPressure: mouse (no pressure) keeps base width, pen scales up to 2x", () => {
  assert.equal(widthForPressure(2, undefined), 2);
  assert.equal(widthForPressure(2, 0), 2);
  assert.equal(widthForPressure(2, 0.5), 2);
  assert.equal(widthForPressure(2, 1), 3);
  assert.equal(widthForPressure(2, 5), 3); // clamped
});

test("distance is Euclidean", () => {
  assert.equal(distance({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
});

test("capture: down/move/up builds a stroke, close moves are dropped", () => {
  const cap = createStrokeCapture({ minDistance: 2, baseWidth: 3 });
  cap.pointerDown({ x: 10, y: 10 });
  assert.equal(cap.isDrawing(), true);
  cap.pointerMove({ x: 10.5, y: 10.5 }); // too close: dropped
  cap.pointerMove({ x: 20, y: 10 });
  cap.pointerMove({ x: 30, y: 20 });
  const stroke = cap.pointerUp();
  assert.equal(cap.isDrawing(), false);
  assert.deepEqual(stroke.points, [
    { x: 10, y: 10 },
    { x: 20, y: 10 },
    { x: 30, y: 20 },
  ]);
  assert.equal(stroke.width, 3);
});

test("capture: down/up with no move is a dot stroke", () => {
  const cap = createStrokeCapture();
  cap.pointerDown({ x: 5, y: 5 }, "#ff0000");
  const stroke = cap.pointerUp();
  assert.equal(stroke.points.length, 1);
  assert.equal(stroke.color, "#ff0000");
});

test("capture: moves and ups with no active stroke are ignored", () => {
  const cap = createStrokeCapture();
  assert.equal(cap.pointerMove({ x: 1, y: 1 }), null);
  assert.equal(cap.pointerUp(), null);
});

test("capture: pressure on down sets the stroke width", () => {
  const cap = createStrokeCapture({ baseWidth: 4 });
  cap.pointerDown({ x: 0, y: 0, pressure: 1 });
  assert.equal(cap.pointerUp().width, 6);
});

test("capture: explicit width on down overrides the base width", () => {
  const cap = createStrokeCapture({ baseWidth: 4 });
  cap.pointerDown({ x: 0, y: 0 }, "#000000", 10);
  assert.equal(cap.pointerUp().width, 10);
});
