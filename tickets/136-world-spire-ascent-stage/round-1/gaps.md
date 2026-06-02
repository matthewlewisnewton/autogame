1. Capture failed — no runnable proof of the game (infra, NOT game code).
   metrics.json `ok:false`/`capture_failed`; pageerrors empty; server.log shows
   a clean boot (`Server listening on port 3001`, `Player connected`) but
   `port_holders` shows `:3001` empty at diagnosis, and client.log/console.log
   show ECONNREFUSED + 502 (Bad Gateway) then `waitForFunction` timeout. The
   server/proxy lifecycle dropped before the browser could connect; the
   spire-ascent code never even ran (capture used the fallback plan with the
   default training_caverns quest).
   Files: none — harness capture infra, not game/.
   Fix: re-run the capture, keeping the dev server up on :3001 for the whole
   browser session. Do NOT modify game/ — code compiles, server boots, and all
   161 unit tests pass; further code edits will not change the outcome until the
   capture can connect.
