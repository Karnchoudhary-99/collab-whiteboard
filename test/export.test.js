import test from "node:test";
import assert from "node:assert/strict";
import { boardBounds, toSvg } from "../src/export.js";

const board = (strokes) => ({ strokes });

test("export: bounds cover points plus half stroke width, then padding", () => {
  const bounds = boardBounds(board([
    { points: [{ x: 10, y: 20 }, { x: 30, y: 40 }], color: "#111111", width: 4 },
  ]), 10);
  // Half width 2, then padding 10: x from -2, y from 8, to 42/52.
  assert.deepEqual(
    [bounds.minX, bounds.minY, bounds.maxX, bounds.maxY, bounds.width, bounds.height],
    [-2, 8, 42, 52, 44, 44],
  );
});

test("export: empty board has a sane default frame", () => {
  const bounds = boardBounds(board([]));
  assert.equal(bounds.empty, true);
  assert.ok(bounds.width > 0 && bounds.height > 0);
});

test("export: SVG renders a polyline stroke and a single-point dot", () => {
  const svg = toSvg(board([
    { points: [{ x: 0, y: 0 }, { x: 10, y: 10 }], color: "#123456", width: 3 },
    { points: [{ x: 50, y: 60 }], color: "#654321", width: 4 },
  ]));
  assert.match(svg, /<svg[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /<polyline[^>]*points="0,0 10,10"[^>]*stroke="#123456"[^>]*stroke-width="3"/);
  assert.match(svg, /<circle[^>]*cx="50"[^>]*cy="60"[^>]*r="2"[^>]*fill="#654321"/);
  assert.match(svg, /<rect[^>]*fill="#ffffff"/); // opaque background, not transparent
});

test("export: stroke colors are XML-escaped, never injected as markup", () => {
  const svg = toSvg(board([
    { points: [{ x: 0, y: 0 }, { x: 5, y: 5 }], color: 'red" onload="alert(1)', width: 2 },
  ]));
  assert.ok(!svg.includes('onload="alert(1)"'));
  assert.match(svg, /stroke="red&quot; onload=&quot;alert\(1\)"/);
});

test("export: custom padding and background are honoured", () => {
  const svg = toSvg(
    board([{ points: [{ x: 10, y: 10 }], color: "#000000", width: 2 }]),
    { padding: 0, background: "#f0f0f0" },
  );
  // Single point, width 2: half-width 1, padding 0 -> frame 9..11.
  assert.match(svg, /viewBox="9 9 2 2"/);
  assert.match(svg, /<rect[^>]*fill="#f0f0f0"/);
});

test("export: SVG is standalone with a viewBox framing the board", () => {
  const svg = toSvg(board([
    { points: [{ x: 100, y: 100 }, { x: 200, y: 150 }], color: "#000000", width: 2 },
  ]));
  assert.match(svg, /viewBox="83 83 134 84"/); // 100-1(half width)-16 padding, etc.
  assert.match(svg, /width="134" height="84"/);
});
