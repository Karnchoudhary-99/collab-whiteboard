# Realtime Collaborative Whiteboard

A shared canvas where multiple people draw at once: strokes sync live,
cursors are visible, and everyone sees the same board. Plain JavaScript,
no build step for the core board model.

## Roadmap

- [x] Project scaffold (package.json, stroke board model, smoke tests, CI, README)
- [x] Drawing canvas + stroke capture (pointer events, pressure/width, live preview)
- [x] Realtime sync (rooms, SSE broadcast, late-joiner state, stroke ids for echo dedup)
- [ ] Live cursors + presence
- [ ] Export to PNG/SVG, then self-review checklist, then public

## Quick start

```sh
npm test    # 21 tests, dependency-free (node --test)
npm start   # server on http://127.0.0.1:8000 — open it in two windows and draw
```

Pick a room in the toolbar (or `?room=team-1`); everyone in the same room
shares one board. Strokes post optimistically and are deduped by id when
the server echoes them back over SSE; undo/clear apply from the broadcast
so they can never double-apply. `examples/sync-demo.sh` is a curl tour of
the API.

## Sync API

| Route | Meaning |
|---|---|
| `GET /rooms/:id` | Full board state — what a late joiner loads |
| `POST /rooms/:id/strokes` | `{points, color, width, id?}` → 201, broadcast to the room |
| `POST /rooms/:id/undo` | Remove the last stroke, broadcast |
| `POST /rooms/:id/clear` | Clear the board, broadcast |
| `GET /rooms/:id/events` | Server-Sent Events broadcast channel |

Room ids are `[A-Za-z0-9_-]{1,64}`. No dependencies: the server is plain
`node:http`, and the client is vanilla JS with no build step.

## License

MIT — see [LICENSE](LICENSE).
