// Browser entry point: pointer capture -> board -> canvas render.
// The sync layer (added next) only feeds strokes into the same board +
// redraw path through the hooks below; drawing itself stays local-first.
import { createBoard, addStroke, clearBoard, undoStroke } from "../src/strokes.js";
import { createStrokeCapture } from "../src/pointer.js";
import { drawBoard, drawStroke } from "./render.js";
import { drawCursors } from "./cursors.js";

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const board = createBoard();
const capture = createStrokeCapture({ minDistance: 2 });
const statusEl = document.getElementById("status");

// Live cursors: peers in this room, keyed by peer id. Our own cursor is
// never rendered — we see our own pointer already.
const peers = new Map();
const myPeerId = crypto.randomUUID();

function otherPeers() {
  return [...peers.values()].filter((p) => p.peerId !== myPeerId);
}

function redraw() {
  drawBoard(ctx, board);
  drawCursors(ctx, otherPeers());
}

// Live preview: committed strokes plus the one still being drawn.
function redrawWithPreview() {
  drawBoard(ctx, board);
  const current = capture.currentStroke?.();
  if (current) drawStroke(ctx, current);
  drawCursors(ctx, otherPeers());
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
  onLocalStroke(stroke) { addStroke(board, stroke.points, stroke.color, stroke.width, stroke.id); redraw(); },
  onRemoteStroke(stroke) { addStroke(board, stroke.points, stroke.color, stroke.width, stroke.id); redraw(); },
  onUndo() { undoStroke(board); redraw(); },
  onClear() { clearBoard(board); redraw(); },
  onState(strokes) { clearBoard(board); for (const s of strokes) addStroke(board, s.points, s.color, s.width, s.id); redraw(); },
};

canvas.addEventListener("pointerdown", (e) => {
  canvas.setPointerCapture(e.pointerId);
  const color = document.getElementById("color").value;
  const width = Number(document.getElementById("width").value);
  capture.pointerDown(canvasPoint(e), color, width);
});

canvas.addEventListener("pointermove", (e) => {
  sendCursor(canvasPoint(e)); // live cursor even when not drawing
  if (!capture.isDrawing()) return;
  if (capture.pointerMove(canvasPoint(e))) redrawWithPreview();
});

canvas.addEventListener("pointerup", () => {
  const stroke = capture.pointerUp();
  if (stroke) hooks.onLocalStroke(stroke);
});

document.getElementById("undo").addEventListener("click", () => hooks.onUndo());
document.getElementById("clear").addEventListener("click", () => hooks.onClear());

// ---- Realtime sync: state load + SSE broadcast + stroke POST --------
// Strokes are applied optimistically, then deduped by id when the server
// echoes them back over SSE (the echo also reaches every other client).
// Undo/clear are echo-only: the sender applies them when its own
// broadcast arrives, so they can never apply twice.
const roomInput = document.getElementById("room");
let currentRoom = (new URLSearchParams(location.search).get("room") || roomInput.value || "lobby").trim();
roomInput.value = currentRoom;
const seenStrokeIds = new Set();

function setStatus(text, offline = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle("offline", offline);
}

async function post(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} -> ${res.status}`);
  return res.json();
}

async function loadState() {
  const res = await fetch(`/rooms/${encodeURIComponent(currentRoom)}`);
  if (!res.ok) throw new Error(`state -> ${res.status}`);
  const { strokes } = await res.json();
  hooks.onState(strokes);
  for (const s of strokes) if (s.id) seenStrokeIds.add(s.id);
}

// ---- Live cursors + presence -----------------------------------------
// Cursor updates are throttled to ~10/s and heartbeated every 5s, so a
// peer that goes silent is pruned server-side within ~15s + sweep.
const nameInput = document.getElementById("name");
let lastCursor = null;
let lastCursorSent = 0;

function displayName() {
  return (nameInput.value || "").trim() || "Guest";
}

function postCursor(point) {
  return post(`/rooms/${encodeURIComponent(currentRoom)}/cursors`, {
    peerId: myPeerId, name: displayName(), x: point.x, y: point.y,
  }).catch(() => {});
}

function sendCursor(point) {
  lastCursor = point;
  const now = Date.now();
  if (now - lastCursorSent < 100) return;
  lastCursorSent = now;
  postCursor(point);
}

setInterval(() => { if (lastCursor) postCursor(lastCursor); }, 5000);

async function loadPresence() {
  const res = await fetch(`/rooms/${encodeURIComponent(currentRoom)}/presence`);
  if (!res.ok) return;
  const { peers: snapshot } = await res.json();
  peers.clear();
  for (const p of snapshot) peers.set(p.peerId, p);
  redraw();
}

function leaveRoom(room) {
  const body = JSON.stringify({ peerId: myPeerId });
  if (navigator.sendBeacon) navigator.sendBeacon(`/rooms/${encodeURIComponent(room)}/leave`, body);
}
window.addEventListener("beforeunload", () => leaveRoom(currentRoom));

let eventSource = null;
function connect() {
  if (eventSource) eventSource.close();
  eventSource = new EventSource(`/rooms/${encodeURIComponent(currentRoom)}/events`);
  eventSource.onopen = () => setStatus(`live — room ${currentRoom}`);
  eventSource.onerror = () => setStatus("offline — drawing locally", true);
  eventSource.onmessage = (msg) => {
    const event = JSON.parse(msg.data);
    if (event.type === "stroke") {
      if (event.stroke.id && seenStrokeIds.has(event.stroke.id)) return; // own echo
      if (event.stroke.id) seenStrokeIds.add(event.stroke.id);
      hooks.onRemoteStroke(event.stroke);
    } else if (event.type === "undo") {
      // Apply only: the broadcast IS the undo. Routing this through
      // hooks.onUndo would re-POST and loop forever.
      undoStroke(board); redraw();
    } else if (event.type === "clear") {
      clearBoard(board); redraw();
    } else if (event.type === "cursor" || event.type === "peer-joined") {
      peers.set(event.peer.peerId, event.peer);
      redraw();
    } else if (event.type === "peer-left") {
      peers.delete(event.peer.peerId);
      redraw();
    }
  };
}

// Server-backed hooks (replace the local defaults above).
hooks.onLocalStroke = (stroke) => {
  stroke.id = crypto.randomUUID();
  seenStrokeIds.add(stroke.id);
  addStroke(board, stroke.points, stroke.color, stroke.width, stroke.id);
  redraw();
  post(`/rooms/${encodeURIComponent(currentRoom)}/strokes`, stroke)
    .catch(() => setStatus("offline — drawing locally", true));
};
hooks.onUndo = () => {
  post(`/rooms/${encodeURIComponent(currentRoom)}/undo`, {})
    .catch(() => { undoStroke(board); redraw(); setStatus("offline — drawing locally", true); });
};
hooks.onClear = () => {
  post(`/rooms/${encodeURIComponent(currentRoom)}/clear`, {})
    .catch(() => { clearBoard(board); redraw(); setStatus("offline — drawing locally", true); });
};

roomInput.addEventListener("change", () => {
  const next = roomInput.value.trim();
  if (!next || next === currentRoom) return;
  leaveRoom(currentRoom);
  peers.clear();
  currentRoom = next;
  history.replaceState(null, "", `?room=${encodeURIComponent(currentRoom)}`);
  loadState().then(loadPresence).then(connect).catch(() => setStatus("offline — drawing locally", true));
});

loadState().then(loadPresence).then(connect).catch(() => setStatus("local mode — start the server for live sync", true));
redraw();
