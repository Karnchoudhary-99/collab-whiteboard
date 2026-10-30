#!/bin/sh
# Curl tour of the presence API. Start the server first: npm start
# (listens on http://127.0.0.1:8000 by default).
set -e
BASE="${BASE:-http://127.0.0.1:8000}"
ROOM="${ROOM:-demo}"

echo "== two peers move their cursors =="
curl -s -X POST -H 'content-type: application/json' \
  -d '{"peerId":"demo-ana","name":"Ana","x":120,"y":80}' \
  "$BASE/rooms/$ROOM/cursors"
echo
curl -s -X POST -H 'content-type: application/json' \
  -d '{"peerId":"demo-bo","name":"Bo","x":300,"y":200}' \
  "$BASE/rooms/$ROOM/cursors"
echo
echo "== presence list (both peers, one color each) =="
curl -s "$BASE/rooms/$ROOM/presence"
echo
echo "== Ana leaves =="
curl -s -X POST -H 'content-type: application/json' \
  -d '{"peerId":"demo-ana"}' \
  "$BASE/rooms/$ROOM/leave"
echo
echo "== presence list (Bo only) =="
curl -s "$BASE/rooms/$ROOM/presence"
echo
echo "== live events: curl -N $BASE/rooms/$ROOM/events =="
