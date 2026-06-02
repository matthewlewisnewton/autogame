1. Capture failed to complete — no runnable proof of the game (harness infra, not game code).
   The Vite dev server connection dropped mid-capture: `Failed to load resource: 409 (Conflict)`
   → `[vite] server connection lost` → repeated `net::ERR_CONNECTION_REFUSED` →
   `page.waitForFunction: Timeout 12000ms exceeded`. `pageerrors` is empty; server.log and
   client.log boot cleanly; 1021/1021 server tests pass.
   Files: none — harness infra, not game code.
   Fix: re-run the capture on a clean Vite instance (`:5173`). Do NOT modify `game/`; the
   smoke-bomb code fully satisfies the acceptance criteria and further code edits will not
   change the outcome until the capture succeeds.
