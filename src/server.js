// Realtime sync server: plain node:http, zero dependencies.
//
//   GET  /                          the drawing page
//   GET  /app.js, /render.js, /src/*.js   static client code
//   GET  /rooms/:id                 full board state (late-joiner sync)
//   POST /rooms/:id/strokes         {points, color, width} -> 201, broadcast
//   POST /rooms/:id/undo            remove last stroke, broadcast
//   POST /rooms/:id/clear           clear board, broadcast
//   POST /rooms/:id/cursors         {peerId, name, x, y} -> 200, broadcast
//   POST /rooms/:id/leave           {peerId} -> 200, broadcast peer-left
//   GET  /rooms/:id/presence        current peers (stale peers pruned first)
//   GET  /rooms/:id/events          Server-Sent Events broadcast channel
//
// The request handler is exported separately from the listener so tests
// can drive it with stub req/res objects and never bind a socket.
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRooms, isValidRoomId } from "./rooms.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PUBLIC_DIR = path.join(HERE, "..", "public");
export const SRC_DIR = HERE;

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

const MAX_BODY_BYTES = 1_000_000;

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(body);
}

async function readBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) throw Object.assign(new Error("body too large"), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function serveStatic(res, filePath) {
  const ext = path.extname(filePath);
  try {
    const body = await readFile(filePath);
    res.writeHead(200, { "content-type": CONTENT_TYPES[ext] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    sendJson(res, 404, { error: "not found" });
  }
}

export function createRequestHandler(rooms, { publicDir = PUBLIC_DIR, srcDir = SRC_DIR } = {}) {
  return async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      const parts = url.pathname.split("/").filter(Boolean);

      // Static client files.
      if (req.method === "GET" && url.pathname === "/") {
        return serveStatic(res, path.join(publicDir, "index.html"));
      }
      if (req.method === "GET" && (url.pathname === "/app.js" || url.pathname === "/render.js" || url.pathname === "/cursors.js")) {
        return serveStatic(res, path.join(publicDir, path.basename(url.pathname)));
      }
      if (req.method === "GET" && parts[0] === "src" && parts.length === 2 && parts[1].endsWith(".js") && !parts[1].includes("..")) {
        return serveStatic(res, path.join(srcDir, parts[1]));
      }

      // Room routes.
      if (parts[0] === "rooms" && parts.length >= 2) {
        const id = parts[1];
        if (!isValidRoomId(id)) return sendJson(res, 400, { error: "invalid room id" });
        const room = rooms.getOrCreate(id);

        if (parts.length === 2 && req.method === "GET") {
          return sendJson(res, 200, { room: id, strokes: room.board.strokes });
        }
        if (parts.length === 3 && parts[2] === "events" && req.method === "GET") {
          res.writeHead(200, {
            "content-type": "text/event-stream",
            "cache-control": "no-cache",
            connection: "keep-alive",
          });
          res.write(": connected\n\n");
          const unsubscribe = room.subscribe((event) => {
            res.write(`data: ${JSON.stringify(event)}\n\n`);
          });
          if (typeof res.on === "function") res.on("close", unsubscribe);
          return;
        }
        if (parts.length === 3 && parts[2] === "strokes" && req.method === "POST") {
          let body;
          try {
            body = JSON.parse(await readBody(req));
          } catch (e) {
            return sendJson(res, e.status ?? 400, { error: e.status ? "body too large" : "invalid JSON" });
          }
          try {
            const clientId = typeof body.id === "string" && body.id.length <= 128 ? body.id : undefined;
            const stroke = room.addStroke(body.points, body.color, body.width, clientId);
            return sendJson(res, 201, { stroke });
          } catch (e) {
            return sendJson(res, 400, { error: e.message });
          }
        }
        if (parts.length === 3 && parts[2] === "presence" && req.method === "GET") {
          room.prunePresence();
          return sendJson(res, 200, { room: id, peers: room.listPresence() });
        }
        if (parts.length === 3 && parts[2] === "cursors" && req.method === "POST") {
          let body;
          try {
            body = JSON.parse(await readBody(req));
          } catch (e) {
            return sendJson(res, e.status ?? 400, { error: e.status ? "body too large" : "invalid JSON" });
          }
          try {
            const peer = room.moveCursor(body.peerId, body.name, body.x, body.y);
            return sendJson(res, 200, { peer });
          } catch (e) {
            return sendJson(res, 400, { error: e.message });
          }
        }
        if (parts.length === 3 && parts[2] === "leave" && req.method === "POST") {
          let body = {};
          try {
            const raw = await readBody(req);
            if (raw.trim() !== "") body = JSON.parse(raw);
          } catch (e) {
            return sendJson(res, e.status ?? 400, { error: e.status ? "body too large" : "invalid JSON" });
          }
          const left = typeof body.peerId === "string" ? room.leavePeer(body.peerId) : false;
          return sendJson(res, 200, { left });
        }
        if (parts.length === 3 && parts[2] === "undo" && req.method === "POST") {
          await readBody(req).catch(() => {});
          return sendJson(res, 200, { undone: room.undo() });
        }
        if (parts.length === 3 && parts[2] === "clear" && req.method === "POST") {
          await readBody(req).catch(() => {});
          room.clear();
          return sendJson(res, 200, { cleared: true });
        }
        return sendJson(res, parts.length === 2 || parts.length === 3 ? 405 : 404, { error: "method not allowed" });
      }

      return sendJson(res, 404, { error: "not found" });
    } catch (e) {
      if (!res.headersSent) sendJson(res, 500, { error: "internal error" });
      else res.end();
    }
  };
}

export function startServer({ port = 8000, host = "127.0.0.1", rooms = createRooms() } = {}) {
  const server = http.createServer(createRequestHandler(rooms));
  // Periodic sweep: a tab that closed without sending leave still
  // disappears within staleAfterMs + this interval for everyone else.
  const sweep = setInterval(() => {
    for (const room of rooms.all()) room.prunePresence();
  }, 5000);
  sweep.unref?.();
  server.on("close", () => clearInterval(sweep));
  server.listen(port, host);
  return server;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  // NB: indexOf returns -1 for a missing flag, so args[-1 + 1] would
  // silently read args[0] — always guard before taking the next token.
  const flagValue = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const portArg = flagValue("--port");
  const hostArg = flagValue("--host");
  const port = portArg && Number.isFinite(Number(portArg)) ? Number(portArg) : 8000;
  const host = hostArg ?? "127.0.0.1";
  const server = startServer({ port, host });
  server.on("listening", () => {
    console.log(`collab-whiteboard server at http://${host}:${port} (rooms at /rooms/:id)`);
  });
}
