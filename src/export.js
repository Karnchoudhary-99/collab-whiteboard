// Board export: a standalone SVG snapshot of the current board.
// Shared by the server route (GET /rooms/:id/export.svg) and the
// browser client (Export SVG button), so both produce identical files.
// PNG export lives in the client only — it redraws the board on an
// offscreen canvas, which has no server-side equivalent here.

export const DEFAULT_PADDING = 16;
export const DEFAULT_BACKGROUND = "#ffffff";

function fmt(n) {
  // Trim float noise from canvas coordinates without losing precision.
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

export function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Frame the board: every point plus half the stroke width (round caps
// extend past the endpoints), then a padding margin. An empty board
// gets a default 800x600 frame so the export is still a valid picture.
export function boardBounds(board, padding = DEFAULT_PADDING) {
  const strokes = board?.strokes ?? [];
  if (strokes.length === 0) {
    return { minX: 0, minY: 0, maxX: 800, maxY: 600, width: 800, height: 600, empty: true };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const stroke of strokes) {
    const half = (stroke.width ?? 2) / 2;
    for (const p of stroke.points) {
      minX = Math.min(minX, p.x - half);
      minY = Math.min(minY, p.y - half);
      maxX = Math.max(maxX, p.x + half);
      maxY = Math.max(maxY, p.y + half);
    }
  }
  minX -= padding;
  minY -= padding;
  maxX += padding;
  maxY += padding;
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY, empty: false };
}

export function toSvg(board, { background = DEFAULT_BACKGROUND, padding = DEFAULT_PADDING } = {}) {
  const bounds = boardBounds(board, padding);
  const shapes = [];
  for (const stroke of board?.strokes ?? []) {
    const color = escapeXml(stroke.color ?? "#222222");
    const width = stroke.width ?? 2;
    if (stroke.points.length === 1) {
      const p = stroke.points[0];
      shapes.push(
        `<circle cx="${fmt(p.x)}" cy="${fmt(p.y)}" r="${fmt(Math.max(width / 2, 0.5))}" fill="${color}"/>`,
      );
    } else if (stroke.points.length > 1) {
      const points = stroke.points.map((p) => `${fmt(p.x)},${fmt(p.y)}`).join(" ");
      shapes.push(
        `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="${fmt(width)}" stroke-linecap="round" stroke-linejoin="round"/>`,
      );
    }
  }
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(bounds.width)}" height="${fmt(bounds.height)}" viewBox="${fmt(bounds.minX)} ${fmt(bounds.minY)} ${fmt(bounds.width)} ${fmt(bounds.height)}">`,
    `<rect x="${fmt(bounds.minX)}" y="${fmt(bounds.minY)}" width="${fmt(bounds.width)}" height="${fmt(bounds.height)}" fill="${escapeXml(background)}"/>`,
    ...shapes,
    `</svg>`,
    ``,
  ].join("\n");
}
