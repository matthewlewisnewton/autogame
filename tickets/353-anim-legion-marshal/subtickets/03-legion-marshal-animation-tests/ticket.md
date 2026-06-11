# Legion Marshal — animation tests and regression guard

Add focused client tests that lock in Legion Marshal's primitive dispatch, server-synced synchronous timing, per-skeleton summon composition, and 315-primitive palette so future card-animation passes cannot silently regress this card. Depends on sub-tickets 01 and 02.

## Acceptance Criteria

- `cardRenderers.test.js` asserts `resolveRenderers('undead_commander')` returns exactly one renderer (`renderUndeadCommander`).
- Updated `undead_commander` render tests verify:
  - `spawnLegionMarshalRallyEffect` is called once at the cast origin with radius `2` and bone/purple palette (`0xe4e4e7` / `0xa855f7`).
  - `spawnMinionSummonInEffect` is called once at the commander origin (when `minionId` is present) and once per `summonedMinions` entry at the skeleton offsets.
  - `spawnLightningArc` (or `spawnProjectileTrail`) is called once per skeleton tether from commander origin to skeleton position.
  - Ground `spawnParticleBurst` calls at `y: 0.35` fire once per skeleton.
  - Renderer does **not** call `spawnSummonEffect` (generic amber ring replaced by rally primitive).
  - Renderer does **not** call `scheduleAfter` (instant server resolution; all flourishes synchronous).
  - Renderer does **not** call `spawnProjectileTrail` for travel (no server travel phase).
- A test documents that `getCardDef('undead_commander').windUpMs` is absent or zero (no 307 charge telegraph for this card).
- Graceful-degradation test: renderer with optional primitives absent (`spawnLegionMarshalRallyEffect`, `spawnLightningArc`, etc. missing) does not throw for a full payload with `minionId` and two `summonedMinions`.
- `pnpm test:quick` passes with no perf-regression patterns.

## Technical Specs

- **`game/client/test/cardRenderers.test.js`**:
  - Extend `makeCtx` to record `spawnLegionMarshalRallyEffect` if not already present.
  - Update the existing `undead_commander renders bone-white/purple caster ring and per-skeleton summon flourishes` test (~L2612) to assert rally primitive, commander + skeleton `spawnMinionSummonInEffect` counts, tether arcs, absence of `spawnSummonEffect` and `scheduleAfter`, and palette values.
  - Add `windUpMs` absence assertion using `getCardDef('undead_commander')` from `../cards.js`.
  - Add no-throw graceful-degradation case with stripped ctx.
- **`game/client/test/vfx-primitives.test.js`**: owned by sub-ticket 01; this ticket only extends `cardRenderers.test.js` unless a gap remains after 01 lands.
- Depends on sub-tickets 01 and 02.

## Verification: code
