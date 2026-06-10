# Extract `effectsSync` module and slim `animate()` orchestrator

Move minion mesh sync, telepipe sync/animation, and per-frame atmosphere updates into `effectsSync.js`. Refactor `animate()` into a short orchestrator (under ~150 lines) that delegates to `lootSync`, `avatarSync`, `playerSync`, `enemySync`, and `effectsSync`, plus existing top-level concerns (input, camera, attack-effect updates, render).

## Acceptance Criteria

- New module `game/client/renderer/effectsSync.js` exports frame helpers for:
  - Minion mesh reconcile (~`animate()` lines 6655–6745): summon scale-in, null-crawler telegraph, minion HP-drop flash/damage numbers, stale disposal, `seenMinionIds` / `minionSpawnTimes` cleanup
  - `syncTelepipeMesh` + `animateTelepipePortal` (move from `renderer.js` or call through thin wrappers)
  - Per-frame atmosphere branch (`updateSpireAscentAtmosphere` / `updateFireCavernAtmosphere` / `resetAtmosphere`) currently at ~6782–6796
- `animate()` in `renderer.js` is **under 150 lines** (excluding blank lines and comments) and reads as an orchestrator: clock/input → domain sync modules → camera → global effect updaters → `renderer.render`.
- No keyed-mesh reconcile loops remain inline in `animate()`; all use extracted modules or `syncMeshMap`.
- `renderer-minion-summon.test.js`, `renderer-telepipe-portal.test.js`, `renderer-spike-trap.test.js`, `spire-atmosphere.test.js`, `fire-atmosphere.test.js`, and the full `pnpm test:quick` renderer suite pass.
- Total rendering behavior unchanged from pre-split baseline (no intentional visual or timing changes).

## Technical Specs

- **Add** `game/client/renderer/effectsSync.js`.
- **Change** `game/client/renderer.js` — `animate()` becomes orchestrator only; move minion sync block and atmosphere frame logic; keep `updateMyPlayer`, `pollInput`, `updateBoothInRange`, `updateCameraOrbit`, `updateAttackEffects`, `updateEnemyHitboxPulse`, `updateDamageNumbers` in `renderer.js` unless they naturally belong in effects (minion/telepipe/atmosphere only in this ticket).
- **Dependencies:** sub-tickets 01–05 must be merged first so `animate()` delegates to all domain modules.
- Re-export `syncTelepipeMesh`, `getMinionSpawnTimes`, atmosphere init/reset exports, and any other symbols external callers/tests import from `renderer.js`.
- Optional: use `syncMeshMap` for `minionsMeshes` primary reconcile.

## Verification: code
