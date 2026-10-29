import test from "node:test";
import assert from "node:assert/strict";
import { createRooms } from "../src/rooms.js";
import { createRequestHandler } from "../src/server.js";

// Stub req/res pair: drives the handler without binding any socket.
function stubReq(method, url, body = null) {
  return {
    method,
    url,
    async *[Symbol.asyncIterator]() {
      if (body !== null) yield Buffer.from(typeof body === "string" ? body : JSON.stringify(body));
    },
  };
}

function stubRes() {
  const listeners = new Map();
  return {
    status: null,
    headers: null,
    chunks: [],
    headersSent: false,
    writeHead(status, headers) { this.status = status; this.headers = headers; this.headersSent = true; },
    write(chunk) { this.chunks.push(chunk.toString()); },
    end(chunk) { if (chunk !== undefined) this.chunks.push(chunk.toString()); },
    on(event, fn) { listeners.set(event, fn); },
    triggerClose() { listeners.get("close")?.(); },
    body() { return this.chunks.join(""); },
    json() { return JSON.parse(this.body()); },
  };
}

async function call(handler, method, url, body = null) {
  const req = stubReq(method, url, body);
  const res = stubRes();
  await handler(req, res);
  return res;
}

test("server: GET / serves the drawing page", async () => {
  const handler = createRequestHandler(createRooms());
  const res = await call(handler, "GET", "/");
  assert.equal(res.status, 200);
  assert.match(res.body(), /Collab Whiteboard/);
});

test("server: stroke POST then state GET round-trips, invalid strokes rejected", async () => {
  const handler = createRequestHandler(createRooms());
  const created = await call(handler, "POST", "/rooms/lobby/strokes", {
    points: [{ x: 1, y: 2 }], color: "#111111", width: 3, id: "client-1",
  });
  assert.equal(created.status, 201);
  assert.equal(created.json().stroke.color, "#111111");
  assert.equal(created.json().stroke.id, "client-1"); // client id echoed for dedup

  const state = await call(handler, "GET", "/rooms/lobby");
  assert.equal(state.status, 200);
  assert.equal(state.json().strokes.length, 1);

  const serverId = await call(handler, "POST", "/rooms/lobby/strokes", {
    points: [{ x: 2, y: 3 }],
  });
  assert.match(serverId.json().stroke.id, /^srv-\d+$/); // no client id -> server sequence

  const bad = await call(handler, "POST", "/rooms/lobby/strokes", { points: [] });
  assert.equal(bad.status, 400);
  const badJson = await call(handler, "POST", "/rooms/lobby/strokes", "{not json");
  assert.equal(badJson.status, 400);
  // Note: "/rooms/../etc" never reaches the room route — URL parsing
  // normalizes it to "/etc" first (a 404), which is safe, not a bug.
  const badRoom = await call(handler, "GET", "/rooms/a b");
  assert.equal(badRoom.status, 400);
  const missing = await call(handler, "GET", "/nope");
  assert.equal(missing.status, 404);
});

test("server: SSE subscriber receives stroke/undo/clear events, stops after close", async () => {
  const handler = createRequestHandler(createRooms());
  const sseReq = stubReq("GET", "/rooms/lobby/events");
  const sseRes = stubRes();
  await handler(sseReq, sseRes);
  assert.equal(sseRes.status, 200);
  assert.equal(sseRes.headers["content-type"], "text/event-stream");

  await call(handler, "POST", "/rooms/lobby/strokes", { points: [{ x: 0, y: 0 }], color: "#000000", width: 2 });
  await call(handler, "POST", "/rooms/lobby/undo", {});
  await call(handler, "POST", "/rooms/lobby/clear", {});
  const events = sseRes.body().split("\n\n").filter((b) => b.startsWith("data: ")).map((b) => JSON.parse(b.slice(6)));
  assert.deepEqual(events.map((e) => e.type), ["stroke", "undo", "clear"]);

  const before = sseRes.chunks.length;
  sseRes.triggerClose();
  await call(handler, "POST", "/rooms/lobby/strokes", { points: [{ x: 5, y: 5 }] });
  assert.equal(sseRes.chunks.length, before);
});
