1. Required round-1 capture does not load cleanly: `metrics.json` has `"ok": false`, browser console shows repeated 502s, Vite logs `connect ECONNREFUSED 127.0.0.1:3004`, and capture times out.
   Files: diagnostics in tickets/280-playthrough-validate-spire-ascent/round-1/{metrics.json,console.log,client.log,server.log}; investigate game/server/index.js if the server process is exiting.
   Fix: identify why the game server on port 3004 becomes unavailable during capture, then rerun the round capture until `metrics.json` is ok with no page errors.
