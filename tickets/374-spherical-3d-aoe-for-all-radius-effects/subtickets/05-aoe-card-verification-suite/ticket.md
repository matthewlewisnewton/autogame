# 05 — Spherical AoE verification suite for every AoE card

Add one comprehensive test file that enumerates EVERY AoE/radius card named in the top-level ticket — frost_nova, glacier_collapse, inferno_pillar, purifying_pulse, event_horizon, gravity_well, dragons_breath, plus the heal radii (purifying_pulse and field medic) — and proves each one is a true 3D sphere: it affects targets at different heights inside the radius and excludes targets that are XZ-close but outside the sphere. This is the ticket's "VERIFY ALL AoE CARDS" deliverable and the regression net for flying enemies.

## Acceptance Criteria

- [ ] A new test file `game/server/test/spherical_aoe_cards.test.js` exists with a clearly labeled describe/test per card: `frost_nova`, `glacier_collapse`, `inferno_pillar`, `purifying_pulse`, `event_horizon`, `gravity_well`, `dragons_breath` — each driven with that card's REAL stats (radius/range/damage from `CARD_DEFS` / `game/shared/cardStats.json`), not made-up radii.
- [ ] For EACH card the suite asserts both directions: (a) a target at a different height (dy ≠ 0) whose 3D distance is ≤ the card's radius IS affected (frozen / damaged / healed / pulled as appropriate), and (b) a target whose XZ distance is ≤ the radius but whose 3D distance exceeds it is NOT affected.
- [ ] `event_horizon` is covered on both components: the pull sphere (`pullRadius`) and the center crush sphere (`centerRadius`).
- [ ] `inferno_pillar` and `dragons_breath` are covered on their persistent ticks (advance time / call `updateAreaEffects`), not only the initial burst.
- [ ] Enemy-side symmetry is covered in the same file: a `volatile_explosion` blast, a radial enemy attack (`isEntityInEnemyAttack`), and the field-medic heal radius each get the same in-sphere/out-of-sphere height pair.
- [ ] The suite passes, and `pnpm test:quick` (from `game/`) passes overall.

## Technical Specs

- New file only: `game/server/test/spherical_aoe_cards.test.js`. No production-code changes expected; if a gap is found (a card still 2D), fix it in `game/server/simulation.js` / `game/server/cardEffects.js` within this sub-ticket and note it.
- Follow the existing vitest pattern (see `game/server/test/purifying_pulse.test.js`): import helpers from `../index.js` / `../simulation.js`, `Object.assign(gameState, createGameState())` per test, insert players/enemies/minions with explicit `y` values, call the exported helpers (`applyFreezeInRadius`, `healPlayersInRadius`, `pullEnemiesToward`, `applyEventHorizon`, `collectRadialHits`, `collectConeHits`, `updateAreaEffects`, `isEntityInEnemyAttack`, `healFieldMedicAlly`, the volatile-explosion spawner) with each card's real `CARD_DEFS` values.
- Useful geometry: for radius R, place the in-sphere target at (0, h, 0)-ish offsets with `hypot ≤ R` (e.g. dy = R·0.6, dx = R·0.6), and the excluded target at dx = R·0.9, dy = R·0.9 so XZ ≤ R but 3D > R.
- Use `vi.useFakeTimers()` / `vi.setSystemTime` to advance DoT ticks past `intervalMs` for inferno_pillar / dragons_breath.
- Depends on sub-tickets 01, 02, and 03.

## Verification: code
