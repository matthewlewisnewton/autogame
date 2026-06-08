# Excalibur Photon windUpMs stat and DPM tune

Add a conservative `windUpMs` recovery lock to `excalibur_photon` using the existing 307 card-windup mechanic. Tune the value with the sub-ticket 01 effective-DPM formula so sustained output moves toward the weapon peer band (Q3 ≈ 0.031 `damagePerMs`) without touching per-hit damage, cooldown, charges, or `swingsPerUse`.

## Acceptance Criteria

- `game/shared/cardStats.json` defines `windUpMs` on `excalibur_photon`; `damage` remains **14**, `cooldownMs` **200**, `swingsPerUse` **2**, and `charges` **6** unchanged.
- `getCardDef('excalibur_photon').windUpMs` matches the JSON value (merged via `CARD_DEFS` like other wind-up cards).
- Effective `damagePerMs` for `excalibur_photon` (per the wind-up-aware harness) is **at or below ~0.045** and **strictly below** the pre-tune ~0.140 baseline — i.e. materially closer to weapon Q3 without requiring a full nerf to Q3.
- `game/server/test/card_windup_regression.test.js` includes `excalibur_photon` in the exemplar `windUpMs` exposure test alongside `steel_claymore` / `magma_greatsword`.
- `game/server/test/card_evolution.test.js` and `game/server/test/new_card_pack.test.js` expect the new `windUpMs` field without weakening existing damage/cooldown/swings assertions.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **`game/shared/cardStats.json`**: add `"windUpMs": <tuned>` under `excalibur_photon`. Starting guidance: weapon Q3 needs ~703 ms wind-up at 200 ms cooldown (28 dmg / 903 ms cycle ≈ 0.031); pick a **conservative** value in the **400–650 ms** range that satisfies the acceptance band above (e.g. ~500–600 ms is in-family with `steel_claymore` / `dungeon_drake`).
- **`game/server/test/card_windup_regression.test.js`**: assert `getCardDef('excalibur_photon').windUpMs` equals the live stat.
- **`game/server/test/card_evolution.test.js`**: extend `CARD_DEFS.excalibur_photon` `toMatchObject` with `windUpMs`.
- **`game/server/test/new_card_pack.test.js`**: add `windUpMs` expectation on the Excalibur Photon describe block; keep `damage === 14` and double-swing cone test using 14 per swing.
- **`game/server/test/card_balance_metrics.test.js`**: add an assertion that `excalibur_photon.damagePerMs` meets the tuned band (imports harness from sub-ticket 01).
- No changes to `game/server/cardEffects.js` or `game/server/simulation.js` unless wind-up unexpectedly fails for `swingsPerUse: 2` weapons (default: forbid — 307 already handles generic weapon wind-up).

## Verification: code
