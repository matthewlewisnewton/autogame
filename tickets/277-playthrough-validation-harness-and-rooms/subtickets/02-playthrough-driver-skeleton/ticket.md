# Playthrough driver skeleton (boot, JWT auth, CLI)

Create the reusable headless Playwright driver scaffold at `harness/validate/playthrough.mjs` with isolated game boot (`ALLOW_DEV_AUTH=1`, `ALLOW_DEBUG_SCENARIOS=1`), JWT register/login, and a parameterizable run config — no Rooms boss flow yet.

## Acceptance Criteria

- `harness/validate/playthrough.mjs` exists and runs headless via `node harness/validate/playthrough.mjs` (or a wired npm script).
- The driver spawns its **own** isolated server + Vite client (high ports, `PERSISTENCE_BACKEND=memory`) with env `ALLOW_DEV_AUTH=1` and `ALLOW_DEBUG_SCENARIOS=1`, mirroring `game/client/scripts/test-deck-loadout.mjs` / `test-quest-completion.mjs`. All child processes are torn down on success **and** failure.
- Auth flow: `POST /api/register` (fallback `POST /api/login`), inject token into `localStorage('autogame_token')`, reload client, and wait until `#auth-overlay` is hidden and socket status shows connected (same pattern as `harness/screenshot.mjs` `loginUser` / sibling smoke scripts).
- Shared helpers live under `harness/validate/lib/` (suggested: `gameProcess.mjs` for spawn/teardown, `auth.mjs` for register/login/token inject, `harnessState.mjs` for `page.evaluate(() => window.__AUTOGAME_HARNESS_STATE__())`, `screenshot.mjs` for named PNG writes).
- CLI accepts `--preset <name>` and `--out <dir>`; default preset name is `rooms` and default out dir is `validation/rooms/`. Preset module exports at least `{ questId, questTier, bossType, deployScenario }` (Rooms default: `training_caverns`, tier `2`, boss `annex_overseer`, deploy scenario `training-caverns-tier-2`).
- A smoke invocation (`--steps auth` or equivalent flag) proves: processes up → register/login → lobby browser visible. Exits `0` with a short JSON summary on stdout; exits non-zero with a clear error on failure.
- `validation/rooms/` directory is created by the driver when missing. Add `harness/package.json` script (e.g. `"validate:playthrough": "node validate/playthrough.mjs"`) and optionally `game/package.json` `"validate:rooms"` delegating to the harness entry.
- No changes under `game/server/` or `game/client/` gameplay code in this sub-ticket.

## Technical Specs

- New: `harness/validate/playthrough.mjs` — CLI entry, orchestrates boot → browser → auth; stubs later steps behind a `--steps` flag (`auth`, `hub`, `boss`, `full`).
- New: `harness/validate/lib/gameProcess.mjs` — `startGame({ serverPort, clientPort })` / `stopGame()` using `child_process.spawn` with `ALLOW_DEV_AUTH: '1'`, `ALLOW_DEBUG_SCENARIOS: '1'`, `PERSISTENCE_BACKEND: 'memory'`, `HARNESS_GAME_PORT` for Vite.
- New: `harness/validate/lib/auth.mjs` — `registerUser(serverUrl, username, password)`, `injectToken(page, token)`.
- New: `harness/validate/lib/harnessState.mjs` — `readHarness(page)` wrapper.
- New: `harness/validate/presets/rooms.mjs` — Rooms / Training Caverns preset constants (see Acceptance Criteria).
- Edit: `harness/package.json` — add `validate:playthrough` script.
- Optional: `game/package.json` — add `validate:rooms` that shells to the harness script.
- Reuse Playwright from `harness/package.json` dependencies; do not duplicate into `game/`.

## Verification: code
