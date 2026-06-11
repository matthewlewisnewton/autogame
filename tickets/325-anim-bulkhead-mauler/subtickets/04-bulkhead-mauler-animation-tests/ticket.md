# Bulkhead Mauler — animation test coverage & regression guard

Lock in the Bulkhead Mauler summon polish and shockwave attack timing sync from sub-tickets 01–03 with focused client tests and a quick-suite green run. Ensure generic creature defaults and unrelated minion renderers remain unchanged.

## Acceptance Criteria

- `resolveRenderers('bulkhead_mauler')` returns exactly **two** renderer functions, neither of which is `renderCreatureSummon` (the creature type default).
- **Summon test**: `renderCardUsed` with `{ cardId: 'bulkhead_mauler', minionId: 'm1', origin: { x: 0, z: 0 }, hits: [] }` asserts:
  - `spawnMinionSummonInEffect` is called with slate/amber bulkhead palette (`0x78716c` / `0xf59e0b`), not the generic green default.
  - `spawnBulkheadMaulerDeployEffect` is called at the summon origin.
  - `spawnBulkheadMaulerShockwaveEffect` is **not** called.
  - No `scheduleAfter` deferral is used.
- **Summon guard test**: payload with `specialEffect: 'shockwave_sweep'` does not call `spawnBulkheadMaulerDeployEffect` or `spawnMinionSummonInEffect`.
- **Attack test**: `renderCardUsed` with `{ cardId: 'bulkhead_mauler', specialEffect: 'shockwave_sweep', origin: { x: 0, z: 0 }, direction: { x: 1, z: 0 }, attackRange: 4, attackConeAngle: (Math.PI * 2) / 3, hits: [{ enemyId: 'e1', hp: 41 }] }` asserts:
  - `spawnBulkheadMaulerShockwaveEffect` is called once with `range: 4`, `coneAngle: (Math.PI * 2) / 3`, and bulkhead palette.
  - `spawnHitSpark` is called for the hit entry.
  - Foot-level `spawnParticleBurst` at the origin uses bulkhead palette.
  - No `scheduleAfter` deferral.
- **Attack guard test**: summon payload (`minionId` present, no `specialEffect`) does not call `spawnBulkheadMaulerShockwaveEffect`.
- **Graceful degradation**: attack renderer with `spawnBulkheadMaulerShockwaveEffect: undefined` does not throw; summon renderer with `spawnBulkheadMaulerDeployEffect: undefined` still calls `spawnMinionSummonInEffect` when present.
- **Registry isolation**: existing `battery_automaton`, `null_crawler`, `skeleton_knight`, and generic creature summon tests continue to pass unchanged.
- Replace/update the existing `cardRenderers.test.js` cases at ~L244–245 (expects length 1) and ~L3766–3804 (generic `spawnAttackEffect` assertions) to match the new primitives and two-renderer registration.
- `cd game && pnpm test:quick` passes (server + client vitest).

## Technical Specs

- **`game/client/test/cardRenderers.test.js`**:
  - Update `resolveRenderers('bulkhead_mauler')` to expect length 2 and distinct summon/attack renderers.
  - Replace the "Bulkhead Mauler shockwave renders a short wide cone" test to assert `spawnBulkheadMaulerShockwaveEffect` (not `spawnAttackEffect`) with server-aligned range/cone/palette.
  - Add summon and guard tests described in Acceptance Criteria.
  - Extend `makeCtx()` recording to stub `spawnBulkheadMaulerDeployEffect` and `spawnBulkheadMaulerShockwaveEffect` if not already present.
- **`game/client/test/vfx-primitives.test.js`**: sub-ticket 01 owns primitive smoke tests; this ticket only adds cross-module assertions if gaps remain after 01–03 land.
- **`game/client/cardRenderers.js`**, **`enemySync.js`**, **`renderer.js`**, **`main.js`**: touch only if a test reveals a genuine bug in sub-tickets 01–03 (minimal fix).
- Do **not** weaken assertions on `battery_automaton`, `null_crawler`, or `skeleton_knight` cases.

## Verification: code
