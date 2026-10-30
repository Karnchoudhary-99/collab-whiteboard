// Live-cursor overlay: draws one arrow + name label per peer on top of
// the board. Pure drawing over a 2D context like render.js, so tests
// drive it with a mock context. Cursors never touch the board model —
// they are presence, not strokes.

export function drawCursor(ctx, peer) {
  ctx.fillStyle = peer.color;
  ctx.strokeStyle = peer.color;
  // Arrowhead pointing at the peer's position.
  ctx.beginPath();
  ctx.moveTo(peer.x, peer.y);
  ctx.lineTo(peer.x + 14, peer.y + 14);
  ctx.lineTo(peer.x + 7, peer.y + 14);
  ctx.lineTo(peer.x + 9, peer.y + 21);
  ctx.lineTo(peer.x + 5, peer.y + 23);
  ctx.lineTo(peer.x + 3, peer.y + 16);
  ctx.lineTo(peer.x, peer.y + 22);
  ctx.closePath();
  ctx.fill();
  // Name label next to the arrow.
  ctx.font = "12px system-ui, sans-serif";
  const label = peer.name;
  const textWidth = typeof ctx.measureText === "function" ? ctx.measureText(label).width : label.length * 7;
  ctx.fillRect(peer.x + 16, peer.y + 12, textWidth + 10, 18);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(label, peer.x + 21, peer.y + 25);
}

export function drawCursors(ctx, peers) {
  for (const peer of peers) drawCursor(ctx, peer);
}
