# Arcane Bolt: raise damage to tier floor

Bring `arcane_bolt` weapon damage from 15 to 20 in server card data so it matches peer long-range pierce weapons. Update the hardcoded stat assertion in the new-card-pack server tests. No simulation or effect-resolution changes.

## Acceptance Criteria

- `CARD_DEFS.arcane_bolt.damage` is `20` in `game/server/progression.js` (was `15`).
- `game/server/test/new_card_pack.test.js` expects `damage: 20` in the Arcane Bolt `toMatchObject` block (~L150–158).
- Projectile hit tests in that file still pass using `CARD_DEFS.arcane_bolt.damage` (no behavioral regressions).
- `cd game && pnpm test:quick` passes (server tests covering `new_card_pack.test.js`).

## Technical Specs

- `game/server/progression.js`: in the `arcane_bolt` entry (~L273–280), change `damage: 15` to `damage: 20`. Do not touch `attackRange`, `projectile`, or `effect`.
- `game/server/test/new_card_pack.test.js`: in `'Arcane Bolt projectile hits at long range and misses beyond range'`, update `toMatchObject({ … damage: 15 … })` to `damage: 20`.
- Do **not** modify `game/server/simulation.js`, `game/server/cardEffects.js`, or client files — balance is server-authoritative via `progression.js` only.

## Verification: code
