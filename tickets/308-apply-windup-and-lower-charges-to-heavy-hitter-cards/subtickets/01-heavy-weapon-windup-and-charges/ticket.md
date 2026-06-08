# Heavy weapons: wind-up + reduced charges

Apply the ticket-303 weapon outliers **Solar Edge** (`flame_blade`) and **Corebreaker Greatsword** (`magma_greatsword`) to the card wind-up mechanic from ticket 307: add or lengthen `windUpMs` proportional to burst power, and lower `charges` so each swing is a scarce, committed hit. Do **not** touch fast multi-swing weapons (e.g. `excalibur_photon`).

## Acceptance Criteria

- `flame_blade` gains a non-zero `windUpMs` (target **700 ms**, between `steel_claymore` 600 and `magma_greatsword`) and `charges` drops from **3 → 2** in `game/shared/cardDefs.json`.
- `magma_greatsword` `windUpMs` increases from **800 → 1100 ms** (longest weapon commitment) and `charges` drops from **4 → 2** in `game/shared/cardDefs.json`.
- Base `damage` and special effects (`burning` on flame_blade, `fire_trail` on magma) are **unchanged** — balance comes from wind-up lockout + fewer uses, not gutting numbers.
- `getCardDef('flame_blade').windUpMs` and `getCardDef('magma_greatsword').windUpMs` match the JSON values; `flame_blade` enters `cardUseState: 'windup'` on `useCard` and blocks movement until resolution (existing 307 path).
- `magma_greatsword` still resolves damage only after `windUpMs` elapses (`card_windup_resolution.test.js` expectations updated for new timing/charges).
- Dealt hands and deck validation use the new charge pools (`charges: 2` on both cards).
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **`game/shared/cardStats.json`**: add `"windUpMs": 700` under `flame_blade`; change `magma_greatsword.windUpMs` to `1100`.
- **`game/shared/cardDefs.json`**: set `flame_blade.charges` and `magma_greatsword.charges` to `2`.
- **`game/server/test/card_windup_state.test.js`**: assert `flame_blade.windUpMs === 700`, `magma_greatsword.windUpMs === 1100`; add/commit-entry test for `flame_blade` if absent.
- **`game/server/test/card_windup_resolution.test.js`**, **`card_windup_lock.test.js`**, **`card_windup_regression.test.js`**: update hardcoded `800` / `charges: 4` literals for `magma_greatsword`.
- **`game/server/test/card_sync.test.js`**, **`game/client/test/cards.test.js`**: update `charges` expectations for both weapons.
- **`game/server/test/server.test.js`**, **`integration.test.js`**, **`new_card_pack.test.js`**: grep and fix any `flame_blade` `charges: 3` or `magma_greatsword` `charges: 4` literals touched by the suite.
- Do **not** edit `cardEffects.js` or client render code in this sub-ticket.

## Verification: code
