# Heavy-hitter windUpMs and charge stat tuning

Apply the 307 wind-up commitment lever and lower charge pools to the 303-report power-spike outliers that are thematically **single big hits**: Solar Edge (`flame_blade`), Corebreaker Greatsword (`magma_greatsword`), and Soul Drain (`soul_drain`). Leave fast multi-swing weapons (e.g. `excalibur_photon`) and summon spells (`battle_familiar`, `astral_guardian`) unchanged.

## Acceptance Criteria

- `game/shared/cardStats.json` defines `windUpMs` on `flame_blade` (**650**) and `soul_drain` (**700**); `magma_greatsword` retains `windUpMs` **800** (already present — do not remove or zero it).
- Per-card `damage`, DoT/trail fields, MS costs, and `swingsPerUse` are **unchanged** on all three cards.
- `game/shared/cardDefs.json` lowers `charges` on `flame_blade` **3 → 2** and `magma_greatsword` **4 → 2**; `soul_drain` stays at **1**.
- `getCardDef()` / `CARD_DEFS` expose the new `windUpMs` and `charges` values after merge (same path as existing wind-up cards).
- `game/server/test/card_windup_regression.test.js` includes `flame_blade` and `soul_drain` in the exemplar `windUpMs` exposure test alongside `magma_greatsword`.
- `game/client/test/cards.test.js` expects the new charge counts for `flame_blade` and `magma_greatsword`.
- `game/server/test/card_balance_metrics.test.js` asserts tuned `windUpMs`, `charges`, and wind-up-aware `damagePerMs` / `damagePerCharge` for the three cards (import harness from `game/validation/card-balance/analyzeCards.mjs`).
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **`game/shared/cardStats.json`**
  - `flame_blade`: add `"windUpMs": 650` (28 base damage — heavy early reward, shorter than magma's 800 ms).
  - `magma_greatsword`: confirm `"windUpMs": 800` remains; no damage/trail stat edits.
  - `soul_drain`: add `"windUpMs": 700` (42 burst evolved finisher — in family with `glacier_collapse` at 700 ms).
- **`game/shared/cardDefs.json`**
  - `flame_blade.charges`: 3 → **2**.
  - `magma_greatsword.charges`: 4 → **2**.
- **`game/server/test/card_windup_regression.test.js`**: extend the exemplar `windUpMs` `it` block with `flame_blade` (650) and `soul_drain` (700).
- **`game/client/test/cards.test.js`**: update `flame_blade` charges expectation to 2; `magma_greatsword` to 2.
- **`game/server/test/card_balance_metrics.test.js`**: add `toMatchObject` rows for the three cards documenting post-tune `windUpMs`, `charges`, and effective `damagePerMs` (harness uses `cooldownMs + windUpMs` when `windUpMs > 0`).
- No changes to `game/server/cardEffects.js`, `game/server/simulation.js`, or client render code in this sub-ticket.

## Verification: code
