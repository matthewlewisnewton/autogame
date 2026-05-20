# Clean Capture Run: verify game starts and loads

## Description

All implementation sub-tickets (01–05) have passed. The previous capture run failed because port 5173 was occupied by a stale Vite process, preventing the dev server from starting. This sub-ticket verifies the game code is in a clean, runnable state so the harness can produce a successful capture with `metrics.json` reporting `"ok": true`.

## Acceptance Criteria

- `game/server/index.js` starts cleanly on port 3000 (no syntax or import errors).
- `game/client/main.js` loads without runtime errors in the browser.
- Vite dev server configuration (`game/client/package.json`, `game/client/vite.config.*`) uses `--port 5173 --strictPort` and starts without conflict.
- No game code changes are needed — the working tree already satisfies all acceptance criteria from the top-level ticket.
- A clean capture run produces `metrics.json` with `"ok": true`, `console.log` free of 502 Bad Gateway errors, and screenshots showing the game loaded (not "No players yet" on both tabs).

## Technical Specs

- **No game code changes.** This sub-ticket is a verification pass confirming the game is runnable.
- The harness port cleanup (`harness/lib.sh` — `stop_game`, `wait_port_free`, `fuser -k`) should free port 5173 before Vite starts.
- Files verified: `game/server/index.js`, `game/client/main.js`, `game/client/package.json`

## Verification: code
