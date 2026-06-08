# Add windUpMs to excalibur_photon card stats

Add a conservative `windUpMs` recovery lock to Excalibur Photon in shared card data so the existing 307 wind-up mechanic can throttle its spam without touching per-hit damage. Pick a value in the **500–650 ms** band (starting point **600 ms**): at 600 ms the paper sustained cycle is `200 + 600 = 800 ms` per double swing, yielding effective DPM ≈ `0.035` — materially below today's `0.140` but still above `saber_of_light` (`0.030`).

## Acceptance Criteria

- `game/shared/cardStats.json` entry `excalibur_photon` includes a positive `windUpMs` (500–650 ms; prefer **600** unless playtest math forces adjustment).
- `excalibur_photon.damage` remains **14**; `cooldownMs` remains **200**; `swingsPerUse` remains **2**; `specialEffect` remains `photon_barrage`.
- `getCardDef('excalibur_photon').windUpMs` returns the new value via merged `CARD_DEFS`.
- `game/server/test/card_windup_regression.test.js` lists `excalibur_photon` among cards that expose `windUpMs`.
- `game/server/test/card_evolution.test.js` and `game/server/test/new_card_pack.test.js` assert the live `windUpMs` value alongside existing damage/cooldown/swings checks.
- No edits to `game/server/cardEffects.js`, `game/server/simulation.js`, or client code.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **`game/shared/cardStats.json`**: add `"windUpMs": 600` (tunable within 500–650) to the `excalibur_photon` object; do not change any other field on this card or other cards.
- **`game/server/test/card_windup_regression.test.js`**: extend the exemplar `windUpMs` exposure test to expect `getCardDef('excalibur_photon').windUpMs` equals the chosen value.
- **`game/server/test/card_evolution.test.js`**: add `windUpMs` to the `toMatchObject` on `CARD_DEFS.excalibur_photon` after evolution.
- **`game/server/test/new_card_pack.test.js`**: assert `CARD_DEFS.excalibur_photon.windUpMs` is defined and within the accepted band.
- **`game/client/test/cards.test.js`** (optional): add `windUpMs` to the `excalibur_photon` `toMatchObject` if that file already asserts merged defs for this card.

## Verification: code
