// Pointer-stroke capture: turns raw pointer positions into clean strokes.
//
// Kept DOM-free on purpose: the browser hands us {x, y, pressure} points
// and this module decides what becomes a stroke point. That makes the
// capture rules unit-testable without a canvas, and shared between the
// local drawing path and any future input device.
//
// Rules:
// - A stroke starts on pointer-down and ends on pointer-up; a lone
//   down/up with no move is still a stroke (a dot).
// - Moves closer than minDistance to the last kept point are dropped,
//   so slow drags don't bloat strokes with duplicate points.
// - Pressure scales the width: no pressure data (mouse) keeps the base
//   width; a full press widens it up to 2x.

export function widthForPressure(baseWidth, pressure) {
  if (typeof pressure !== "number" || !Number.isFinite(pressure) || pressure <= 0) {
    return baseWidth;
  }
  const p = Math.min(pressure, 1);
  return baseWidth * (0.5 + p);
}

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function createStrokeCapture({ minDistance = 2, baseWidth = 2 } = {}) {
  let current = null;

  return {
    pointerDown(point, color = "#222222", width = baseWidth) {
      if (current) return null; // stray down mid-stroke: ignore
      current = {
        points: [{ x: point.x, y: point.y }],
        color,
        width: widthForPressure(width, point.pressure),
      };
      return current;
    },

    pointerMove(point) {
      if (!current) return null;
      const last = current.points[current.points.length - 1];
      if (distance(last, point) < minDistance) return null;
      current.points.push({ x: point.x, y: point.y });
      return current;
    },

    pointerUp() {
      const done = current;
      current = null;
      return done;
    },

    isDrawing() {
      return current !== null;
    },

    // The in-progress stroke for live preview rendering (null when idle).
    currentStroke() {
      return current;
    },
  };
}
