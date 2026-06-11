# Bulkhead Mauler — real-payload renderer regression tests

Add client tests that exercise the **actual** server `CARD_USED` payloads for Bulkhead Mauler deploy and attack. Round-1 tests omitted `specialEffect` on deploy, so the suite stayed green while deploy VFX was broken in gameplay. Depends on sub-ticket 05 (guard fix).

## Acceptance Criteria

- **Real deploy test**: `renderCardUsed` with `{ cardId: 'bulkhead_mauler', minionId: 'm1', specialEffect: 'shockwave_sweep', origin: { x: 0, z: 0 } }` — **no** `direction`, **no** `hits` — asserts:
  - `spawnBulkheadMaulerDeployEffect` is called at the origin with bulkhead palette (`0x78716c` / `0xf59e0b`).
  - `spawnMinionSummonInEffect` is called with bulkhead palette.
  - `spawnBulkheadMaulerShockwaveEffect` is **not** called.
  - No `scheduleAfter` deferral.
- **Real attack test**: `renderCardUsed` with `{ cardId: 'bulkhead_mauler', minionId: 'm1', specialEffect: 'shockwave_sweep', origin: { x: 0, z: 0 }, direction: { x: 1, z: 0 }, attackRange: 4, attackConeAngle: (Math.PI * 2) / 3, hits: [{ enemyId: 'e1', hp: 41 }] }` asserts:
  - `spawnBulkheadMaulerShockwaveEffect` is called once with `range: 4`, `coneAngle: (Math.PI * 2) / 3`, and bulkhead palette.
  - `spawnBulkheadMaulerDeployEffect` and `spawnMinionSummonInEffect` are **not** called.
- Update or replace the misleading **summon guard** test at ~3395 that passes `specialEffect: 'shockwave_sweep'` **with** `direction`/`hits` — that payload is an attack event, not a deploy guard case; rename/re-scope it so it clearly tests "attack payload does not fire deploy VFX" rather than "shockwave_sweep blocks summon".
- Update the **attack guard** test at ~3886 so the summon-side negative case uses the real deploy shape (`minionId` + `specialEffect: 'shockwave_sweep'` + `origin`, no `direction`/`hits`) instead of omitting `specialEffect`.
- Existing idealized summon test (~3362, no `specialEffect`) and attack test (~3854) may remain but must not contradict the real-payload cases.
- `cd game && pnpm test:quick` passes (server + client vitest).

## Technical Specs

- **`game/client/test/cardRenderers.test.js`**:
  - Add the real deploy and real attack tests described above in the `bulkhead_mauler` describe block (~3360–3933).
  - Fix the mis-scoped guard tests at ~3395 and ~3886 to match server payload shapes from `cardEffects.js` ~1393–1401 (deploy) and `simulation.js` ~3711–3721 (attack).
  - Reuse existing `makeCtx()` stubs for `spawnBulkheadMaulerDeployEffect` and `spawnBulkheadMaulerShockwaveEffect`.
- **`game/client/cardRenderers.js`**: touch only if a test reveals a remaining guard bug from sub-ticket 05 (minimal fix).
- Do **not** weaken assertions on unrelated cards (`battery_automaton`, `null_crawler`, `skeleton_knight`, wyrm tests).

## Verification: code
