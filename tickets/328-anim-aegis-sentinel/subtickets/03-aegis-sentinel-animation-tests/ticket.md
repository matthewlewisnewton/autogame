# Aegis Sentinel — animation test coverage & regression guard

Lock in the Aegis Sentinel cast polish and timing sync from sub-tickets 01–02 with focused client tests and a quick-suite green run. Ensure generic creature defaults, Astral Guardian, and unrelated minion renderers remain unchanged.

## Acceptance Criteria

- `resolveRenderers('aegis_sentinel')` returns exactly one renderer function that is NOT `renderCreatureSummon` (the creature type default) and NOT `renderAstralGuardian`.
- **Cast test**: `renderCardUsed` with `{ cardId: 'aegis_sentinel', origin, shieldGranted: 30, minionId, radius: 10, hits: [] }` asserts:
  - `spawnAegisSentinelShieldFlourish` is called at the cast origin with the green aegis palette.
  - `spawnAegisSentinelDeployEffect` is called at the summon origin.
  - `spawnMinionSummonInEffect` is called with green/gold aegis palette (not the generic creature accent default).
  - No `scheduleAfter` deferral is used for the initial cast/deploy path.
- **Summon guard test**: payload without `minionId` still calls shield flourish when `shieldGranted` is present, but does not call deploy or summon-in helpers.
- **Shield-only guard test**: payload without `shieldGranted` and without `minionId` is a no-op for VFX helpers (no throw).
- **Palette distinctness**: aegis renderer helper calls use `0x4ade80` / `0x22c55e` family — not the indigo `astral_guardian` palette (`0x818cf8` / `0x6366f1`).
- **Graceful degradation**: `renderAegisSentinel` with `spawnAegisSentinelDeployEffect: undefined` still calls `spawnMinionSummonInEffect` when present and does not throw.
- **Registry isolation**: existing `astral_guardian`, `battery_automaton`, and `skeleton_knight` renderer tests continue to pass unchanged.
- `cd game && pnpm test:quick` passes (server + client vitest).

## Technical Specs

- **`game/client/test/cardRenderers.test.js`**:
  - Update the `falls back to the creature default for plain creature cards` case (~L198) so it uses a different plain creature (e.g. `battle_familiar`) — `aegis_sentinel` must no longer resolve to `renderCreatureSummon`.
  - Add `resolveRenderers('aegis_sentinel')` identity check distinct from `renderCreatureSummon` and `renderAstralGuardian`.
  - Add cast, summon-guard, shield-only, palette-distinctness, and graceful-degradation tests per Acceptance Criteria; extend `makeCtx()` to stub `spawnAegisSentinelShieldFlourish` and `spawnAegisSentinelDeployEffect` if not already present.
- **`game/client/test/vfx-primitives.test.js`**: sub-ticket 01 owns primitive smoke tests; this ticket only adds cross-module assertions if gaps remain after 01–02 land.
- **`game/client/cardRenderers.js`**, **`renderer.js`**, **`main.js`**: touch only if a test reveals a genuine bug in sub-tickets 01–02 (minimal fix).
- Do **not** weaken assertions on `astral_guardian`, `battery_automaton`, or `skeleton_knight` cases.

## Verification: code
