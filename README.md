# Realtime Collaborative Whiteboard

A shared canvas where multiple people draw at once: strokes sync live,
cursors are visible, and everyone sees the same board. Plain JavaScript,
no build step for the core board model.

## Roadmap

- [x] Project scaffold (package.json, stroke board model, smoke tests, CI, README)
- [ ] Drawing canvas + stroke capture (pointer events, pressure/width)
- [ ] Realtime sync (rooms, broadcast, late-joiner state)
- [ ] Live cursors + presence
- [ ] Undo/redo, export to PNG/SVG, then self-review checklist, then public

## Quick start

```sh
npm test   # stroke board smoke tests, dependency-free
```

## License

MIT — see [LICENSE](LICENSE).
