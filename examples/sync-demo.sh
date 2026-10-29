#!/bin/sh
# Curl tour of the sync API. Start the server first: npm start
# (listens on http://127.0.0.1:8000 by default).
set -e
BASE="${BASE:-http://127.0.0.1:8000}"
ROOM="${ROOM:-demo}"

echo "== post a stroke =="
curl -s -X POST -H 'content-type: application/json' \
  -d '{"points":[{"x":10,"y":10},{"x":120,"y":80}],"color":"#ff0000","width":3}' \
  "$BASE/rooms/$ROOM/strokes"
echo
echo "== board state (late-joiner view) =="
curl -s "$BASE/rooms/$ROOM"
echo
echo "== undo it =="
curl -s -X POST "$BASE/rooms/$ROOM/undo"
echo
echo "== open $BASE/?room=$ROOM in two browser windows and draw =="
echo "== live events: curl -N $BASE/rooms/$ROOM/events =="
