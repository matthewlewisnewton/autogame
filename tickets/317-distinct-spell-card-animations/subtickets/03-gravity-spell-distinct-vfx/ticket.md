# Gravity spell distinct pull / crush VFX

Replace generic radial rings for Gravity Well and Event Horizon with distinct gravity-themed telegraphs and impact flourishes using 315 primitives, so pull and crush spells read separately from other AoE spells.

## Acceptance Criteria

- `gravity_well` is registered in `CARD_RENDERERS` with a bespoke renderer (not `renderGenericSpellBurst`).
- `renderGravityWell` calls `spawnTelegraphRing` at `data.radius` (pull radius) with purple accent (`getAccentHex` fallback `0xc084fc`) plus `spawnParticleBurst` at the origin (inward-pull styling via spread/count) and optionally `spawnImpactDecal` at center.
- `renderEventHorizon` no longer delegates its outer ring to `renderGenericSpellBurst`; outer pull ring uses `spawnTelegraphRing` + `spawnParticleBurst` with the event-horizon accent (`0x581c87` family), inner crush ring keeps a tighter `spawnSummonEffect` or `spawnTelegraphRing` at `data.centerRadius` — visually distinct helper mix from `renderGravityWell`.
- Both renderers guard optional ctx helpers.
- Vitest tests cover `gravity_well` and updated `event_horizon` (two radii still rendered; no `renderGenericSpellBurst` path).
- `pnpm test:quick` passes.

## Technical Specs

- `game/client/cardRenderers.js`:
  - Add `renderGravityWell`.
  - Refactor `renderEventHorizon` (~lines 156–161) to inline outer-ring primitives instead of calling `renderGenericSpellBurst`.
  - Register `gravity_well` in `CARD_RENDERERS`.
- `game/client/test/cardRenderers.test.js`:
  - Add `gravity_well` tests.
  - Update `event_horizon` test to assert telegraph/burst primitives on outer ring while preserving inner/outer radius ordering.

Payload reference: gravity_well emits `{ origin, radius, pulled }`; event_horizon emits `{ origin, radius, centerRadius }`.

## Verification: code
