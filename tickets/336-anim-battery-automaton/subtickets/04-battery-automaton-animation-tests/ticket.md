# Battery Automaton — animation test coverage & regression guard

Lock in the Battery Automaton summon polish and charge-pulse timing sync from sub-tickets 01–03 with focused client tests and a quick-suite green run. Ensure generic creature defaults and unrelated minion renderers remain unchanged.

## Acceptance Criteria

- `resolveRenderers('battery_automaton')` returns exactly one renderer function that is NOT `renderCreatureSummon` (the creature type default).
- **Summon test**: `renderCardUsed` with `{ cardId: 'battery_automaton', minionId, origin, hits: [] }` asserts:
  - `spawnMinionSummonInEffect` is called with amber/cyan battery palette (not the generic green default).
  - `spawnBatteryAutomatonDeployEffect` is called at the summon origin.
  - No `scheduleAfter` deferral is used for the initial deploy.
- **Summon guard test**: payload without `minionId` does not call `spawnBatteryAutomatonDeployEffect` or `spawnMinionSummonInEffect` (sound-only / no-op path preserved).
- **Charge-pulse sync test** (new or extended in `renderer-minion-summon.test.js` or a dedicated minion-sync test): simulating a `battery_automaton` minion whose `lastChargePulseAt` advances between two `syncMinionMeshes` / `animate` frames triggers exactly one `spawnBatteryChargePulseEffect` call; no pulse on first sighting with unchanged `lastChargePulseAt`.
- **Registry isolation**: existing `skeleton_knight`, `chrono_trigger`, and generic creature summon tests continue to pass unchanged.
- **Graceful degradation**: `renderBatteryAutomaton` with `spawnBatteryAutomatonDeployEffect: undefined` still calls `spawnMinionSummonInEffect` when present and does not throw.
- `cd game && pnpm test:quick` passes (server + client vitest).

## Technical Specs

- **`game/client/test/cardRenderers.test.js`**:
  - Replace/update the vanilla `battery_automaton` creature-dispatch cases (~L2727–2750) to assert the dedicated renderer, deploy primitive, and battery palette on `spawnMinionSummonInEffect`.
  - Add `resolveRenderers('battery_automaton')` identity check distinct from `renderCreatureSummon`.
  - Extend `makeCtx()` recording to stub `spawnBatteryAutomatonDeployEffect` if not already present.
- **`game/client/test/vfx-primitives.test.js`**: sub-ticket 01 owns primitive smoke tests; this ticket only adds cross-module assertions if gaps remain after 01–03 land.
- **`game/client/test/renderer-minion-summon.test.js`** (or new `minion-charge-pulse.test.js` if cleaner):
  - Stub/spy `spawnBatteryChargePulseEffect`; drive two-frame minion state with advancing `lastChargePulseAt`; assert single pulse VFX invocation.
- **`game/client/cardRenderers.js`**, **`minionSync.js`**, **`renderer.js`**: touch only if a test reveals a genuine bug in sub-tickets 01–03 (minimal fix).
- Do **not** weaken assertions on `skeleton_knight`, `mana_prism`, or `chrono_trigger` cases.

## Verification: code
