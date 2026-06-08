# Heavy spells: wind-up commitment

Add `windUpMs` to the remaining ticket-303 **single-burst spell outliers** that are thematically big committed hits (not fast weapons, not sustained minion pressure). Spells stay at **1 charge** — wind-up is the balance lever. Pick wind-up duration from burst tier, using `glacier_collapse` (700 ms) as the evolved-spell baseline.

## Acceptance Criteria

- **`battle_familiar`** (Signal Familiar, harness burst 44, early reward outlier): `windUpMs` **750 ms** in `cardStats.json`.
- **`soul_drain`** (evolved life-drain finisher, burst 42): `windUpMs` **850 ms**.
- **`astral_guardian`** (evolved guardian finisher, burst 63): `windUpMs` **950 ms** — longest spell commitment, still below `magma_greatsword` weapon tier.
- Each card enters `cardUseState: 'windup'` on cast, defers effect resolution until `windUpMs` elapses, and does **not** change `damage`, `magicStoneCost`, or summon fields.
- At least one server test per card (new `game/server/test/heavy_spell_windup.test.js` or extensions to `card_windup_types.test.js`) verifies commit → wait → single resolution (damage and/or minion spawn per card type).
- `excalibur_photon` and other non-candidate cards remain without `windUpMs`.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **`game/shared/cardStats.json`**: add `windUpMs` to `battle_familiar`, `soul_drain`, and `astral_guardian` only (values above).
- **`game/server/test/card_windup_types.test.js`** or **`game/server/test/heavy_spell_windup.test.js`** (new): lifecycle tests for the three spells using the existing `setupWindupCard` / `processPendingCardWindups` patterns from ticket 307.
- **`game/server/test/card_windup_regression.test.js`**: extend the exemplar `windUpMs` list to include the three spells; keep instant cards (`frost_nova`, `iron_sword`) undefined.
- **`game/server/test/battle_familiar.test.js`**, **`soul_drain.test.js`**, **`astral_guardian.test.js`**: update only if they assert instant resolution or lack wind-up advance helpers.
- Do **not** change `cardDefs.json` charges (all remain 1) or weapon cards from sub-ticket 01.

## Verification: code
