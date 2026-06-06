# Revert out-of-scope gameplay changes; stabilize telepipe probes in harness

Round-3 review found real gameplay/balance regressions introduced to stabilize validation probes. Revert those server/client behavior changes and keep telepipe-reset proof working purely inside `harness/validate/**` (test hooks like `__abandonSuspendedRunForTest` and harness-state probes are fine to keep).

## Acceptance Criteria

- **`game/server/simulation.js`**: restore `regenMagicStones()` to always apply passive regen (`MAGIC_STONES_REGEN_PER_TICK`) with no fresh-deploy skip branch.
- **Remove `hasSpentMagicStonesThisRun`** from run/player state and all threading in `game/server/progression.js`, `game/server/index.js`, `game/server/cardEffects.js`, and `game/server/keyItemEffects.js`.
- **`game/client/main.js`**: remove the solo-squad early return in `showExtractedLobbyOverlay()` and remove `isReady = false` resets added solely for `RUN_SUSPENDED` / `RUN_ABANDONED` (keep `abandonRunBtnUsable`, `runId`, and `window.__abandonSuspendedRunForTest` from sub-ticket **09**).
- **`game/client/cosmeticForm.js`**: remove the added `#112233` swatch from `BODY_COLOR_PALETTE`; update `harness/validate/playthrough.mjs` booth staging to use a color already in the palette (e.g. `#1e293b`).
- **`harness/validate/lib/telepipe.mjs`**: `abandonSuspendedRun()` calls `window.__abandonSuspendedRunForTest()` first (or exclusively) so abandon works without the reverted solo overlay behavior; MS/charge probes remain stable without gameplay hacks — e.g. read `postDeploy` MS immediately after `waitForPlaying` (before regen ticks accumulate), or assert fresh-deploy via `runId` change + full charges + `magicStones >= STARTING_MAGIC_STONES` with a documented tolerance if passive regen has ticked.
- Remove or rewrite server tests that depended on `hasSpentMagicStonesThisRun` / regen-skip behavior in `game/server/test/server.test.js`; keep the abandon→fresh-deploy integration test from sub-ticket **10**.
- `cd game && pnpm test:quick` passes.
- No edits under passed sub-ticket artifact folders.

## Technical Specs

- Revert targets: `game/server/simulation.js`, `game/server/progression.js`, `game/server/index.js`, `game/server/cardEffects.js`, `game/server/keyItemEffects.js`, `game/client/main.js`, `game/client/cosmeticForm.js`.
- Harness edits: `harness/validate/lib/telepipe.mjs` (abandon path + MS probe timing), `harness/validate/playthrough.mjs` (booth color constant).
- Test edits (minimal): `game/server/test/server.test.js` — drop `hasSpentMagicStonesThisRun` cases; preserve telepipe abandon fresh-deploy coverage.
- Scope: revert gameplay + harness-only probe fixes; do **not** change `harness/screenshot.mjs` capture-plan logic (sub-ticket **13**).

## Verification: code
