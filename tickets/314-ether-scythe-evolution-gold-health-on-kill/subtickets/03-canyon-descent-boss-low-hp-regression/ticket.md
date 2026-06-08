# Fix canyon-descent boss-low-hp debug scenario regression

The Soul Reaper work is complete, but the ticket-level harness coverage run still fails: after `canyon-descent-tier-2` deploy, the `canyon-descent-boss-low-hp` shortcut must leave the encounter miniboss at **1 HP** in both authoritative server state and the emitted `stateUpdate` snapshot. Restore deterministic behavior so vitest coverage is green again.

## Acceptance Criteria

- `debugScenario — canyon-descent-tier-2 > positions miniboss at 1 HP beside the player in playing phase` passes in `game/server/test/debug-scenarios.test.js` (assertions at lines ~1012 and ~1022: encounter boss `type === 'miniboss'`, `hp === 1` in both `testGameState()` and the captured `stateUpdate.enemies` entry).
- `canyon-descent-boss-low-hp` in `debugScenarios.js` still requires an active `canyon_descent` Tier 2 stage-boss run, clears non-boss adds, repositions the miniboss beside the player, activates/locks the encounter, and sets `boss.hp = 1` with shields cleared (same contract as `arena-trials-boss-low-hp`, `training-caverns-boss-low-hp`, `spire-ascent-boss-low-hp`).
- The `STATE_UPDATE` emitted at the end of `canyon-descent-boss-low-hp` reflects the 1-HP miniboss (not a stale 300-HP snapshot from an earlier deploy/loot broadcast).
- Full server test suite passes: `cd game && pnpm test:quick` (or the harness coverage command) reports zero failures.
- No changes to Soul Reaper card data, `collectConeHits`, or `cardEffects.js` kill-reward logic.

## Technical Specs

- **`game/server/debugScenarios.js`** — `canyon-descent-boss-low-hp` block (~1001–1040):
  - Compare with the passing `arena-trials-boss-low-hp` / `training-caverns-boss-low-hp` implementations (~697–735, ~1001–1040 elsewhere).
  - Likely failure mode (from round-1 review): authoritative state already has `boss.hp === 1`, but the test's first post-emit `stateUpdate` still shows `300` because a late broadcast from the tier-2 deploy or loot spawn wins the race.
  - Fix by making the scenario's final snapshot authoritative: e.g. set `boss.hp = 1` (and shield fields) immediately before `stateSnapshot()`, ensure encounter activation does not reset HP, and avoid emitting an intermediate `STATE_UPDATE` that can arrive after the test registers its listener.
  - If async side effects (loot spawn, game-loop tick) can still emit a competing update, re-apply the 1-HP clamp right before broadcast or emit only once after all mutations settle.
- **`game/server/test/debug-scenarios.test.js`** — `positions miniboss at 1 HP beside the player in playing phase` (~989–1024):
  - If the scenario fix alone is insufficient under coverage load, harden the test the same way other harness tests avoid stale snapshots (see `runScenarioCaptureSnapshot` in `integration.test.js` ~4614–4637): capture `stateUpdate` events between emit and result, then select the snapshot whose encounter boss has `hp === 1`, **or** await a predicate-based `stateUpdate` instead of the first post-emit event.
  - Keep assertions for encounter phase `ACTIVE`, encounter `locked`, player–boss distance 2–5.5, and boss type `miniboss`.
- Do **not** modify subticket `01`/`02` game files except where required for this regression; do **not** edit `review-feedback.md`, `round-1/review.md`, or any folder containing a `.passed` marker.

## Verification: code
