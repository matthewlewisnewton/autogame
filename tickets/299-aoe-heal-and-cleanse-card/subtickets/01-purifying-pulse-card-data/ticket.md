# Purifying Pulse card data

Add the new support spell `purifying_pulse` to the shared card definition files and the client visual metadata layer. This sub-ticket registers the card identity and stats only — no combat logic or VFX.

## Acceptance Criteria

- `game/shared/cardDefs.json` contains a `purifying_pulse` entry: `id: "purifying_pulse"`, `name: "Purifying Pulse"`, `type: "spell"`, `charges: 1`, `acquisition: "reward"`, and `rewardOrder: 27` (next unused integer after `chain_lightning`).
- `game/shared/cardStats.json` contains a `purifying_pulse` stat object with: `magicStoneCost: 0`, `effect: "purifying_pulse"`, `healAmount` in the **12–18** range (smaller than `healing_font`'s 25), `radius` in the **5–6** range, and `specialEffect: "heal_and_cleanse"`.
- Server and client merged `CARD_DEFS.purifying_pulse` both resolve with the expected fields (shared JSON merge — no drift).
- `SHOP_CARD_POOL` includes `purifying_pulse` via the `acquisition: "reward"` → `VICTORY_REWARD_ROTATION` path in `game/server/config.js`.
- `game/client/cards.js` `CARD_ACCENT_STYLE.purifying_pulse` has a heal/cleanse-themed color (e.g. `#a7f3d0` mint-green) and icon (e.g. `✦` or `♡`).
- Card-count / sync tests remain green (`card_sync`, `cards.test.js`, `new_card_pack_definitions.test.js`).

## Technical Specs

- **`game/shared/cardDefs.json`**: add the `purifying_pulse` identity stub near other support spells (`healing_font`, `divine_grace`).
- **`game/shared/cardStats.json`**: add gameplay stats as above. `healAmount` is a flat HP restore per ally hit (not a percent).
- **`game/client/cards.js`**: add `purifying_pulse` to `CARD_ACCENT_STYLE` only (stats come from shared JSON merge). Do **not** add combat logic or renderers here.
- Do **not** modify `game/server/cardEffects.js`, `game/server/simulation.js`, or `game/client/cardRenderers.js` in this sub-ticket.

## Verification: code
