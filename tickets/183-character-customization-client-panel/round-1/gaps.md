1. Capture failed — no runnable proof of the game (`metrics.json` ok:false,
   failure_kind "capture_failed"). Both dev servers dropped out mid-run: vite
   "server connection lost" + net::ERR_CONNECTION_REFUSED, and port_holders show
   :5173 and :3000 both empty. pageerrors is empty and server.log shows no crash.
   Files: none — this is harness/capture infra, not game code (the ticket is
   100% client-side and the smoke flow never opens the customization panel).
   Fix: re-run the capture after the harness operator clears the dev-server
   dropout; do NOT modify game/ — the code is correct and would pass on a clean run.
