# 04 — Enumerated AoE card height integration tests

Add focused integration tests for every AoE/radius card named in ticket 374, proving each affects valid targets at different heights and excludes out-of-sphere targets. Depends on sub-tickets 01–03.

## Acceptance Criteria

- `game/server/test/spherical_aoe_cards.test.js` (new) contains a `describe` block per enumerated effect with at least two height scenarios: **in-sphere** (target affected) and **out-of-sphere** (target unaffected) while holding horizontal offset constant where possible.
- Covered cards/effects (all required):
  - `frost_nova` — freeze/damage via `applyFreezeInRadius` or `useCard`
  - `glacier_collapse` — same path as frost_nova with evolved tuning
  - `inferno_pillar` — initial `collectRadialHits` burst **and** at least one `updateAreaEffects` DoT tick
  - `purifying_pulse` — ally heal radius
  - `event_horizon` — pull radius **and** center crush damage
  - `gravity_well` — pull radius inclusion
  - `dragons_breath` — initial `collectConeHits` burst with tilted aim (height-aware cone from ticket 375); verify in-sphere/out-of-sphere at different Y
  - **Heal radius** — `purifying_pulse` (above) plus `field_medic_kit` key item via socket or direct key-item handler
- Each test sets explicit `y` on caster and target entities (flying-enemy prep) rather than relying only on sloped floor sampling.
- `pnpm test:quick` (or targeted vitest run of the new file) passes.

## Technical Specs

- `game/server/test/spherical_aoe_cards.test.js` (new):
  - Import `handleUseCard` / `useCard` helpers, `updateAreaEffects`, `KEY_ITEM_DEFS` or socket helpers as needed (follow patterns in `new_card_pack.test.js`, `purifying_pulse.test.js`, `field_medic_kit.test.js`).
  - Use `setSimGameState`, `createGameState`, and `getEntityWorldY` to place caster and targets at controlled `(x, y, z)` positions.
  - For pull cards (`gravity_well`, `event_horizon`), assert enemy position change or inclusion in `pulled` array for in-sphere targets and no effect for out-of-sphere targets.
- No production code changes unless a test reveals a missed call site — if so, fix only the specific gap in `game/server/simulation.js`, `cardEffects.js`, or `keyItemEffects.js` and keep the diff minimal.

## Verification: code
