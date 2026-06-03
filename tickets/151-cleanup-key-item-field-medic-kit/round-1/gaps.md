1. Harness capture failed (`metrics.json` `"ok": false`, no `console.log`/screenshots). Playwright package missing for `harness/screenshot.mjs` (`ERR_MODULE_NOT_FOUND: Cannot find package 'playwright'` in `round-1/screenshot.log`). Vite and game server did start on :5174/:3001.
   Files: none — harness infra, not game code.
   Fix: Install/resolve Playwright for the harness (e.g. `pnpm install` in harness or repo root per project setup), then re-run round-1 capture. Do not modify `game/` for this failure.
