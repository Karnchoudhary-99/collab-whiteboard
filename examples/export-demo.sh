#!/bin/sh
# Curl tour of the export API. Start the server first: npm start
# (listens on http://127.0.0.1:8000 by default).
set -e
BASE="${BASE:-http://127.0.0.1:8000}"
ROOM="${ROOM:-demo}"

echo "== post two strokes =="
curl -s -X POST -H 'content-type: application/json' \
  -d '{"points":[{"x":10,"y":10},{"x":120,"y":80}],"color":"#ff0000","width":3}' \
  "$BASE/rooms/$ROOM/strokes"
echo
curl -s -X POST -H 'content-type: application/json' \
  -d '{"points":[{"x":200,"y":40}],"color":"#0000ff","width":5}' \
  "$BASE/rooms/$ROOM/strokes"
echo
echo "== export the board as a standalone SVG =="
curl -s "$BASE/rooms/$ROOM/export.svg"
echo "== same board as PNG: open the page and click Export PNG =="
echo "== $BASE/?room=$ROOM =="
