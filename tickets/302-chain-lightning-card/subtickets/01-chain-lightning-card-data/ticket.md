# Chain Lightning card data

Add the new spell `chain_lightning` to the shared card definition files and the client visual metadata layer. This sub-ticket registers the card identity and stats only — no combat logic.

## Acceptance Criteria

- `game/shared/cardDefs.json` contains a `chain_lightning` entry: `id: "chain_lightning"`, `name: "Voltaic Chain"`, `type: "spell"`, `charges: 1`, `acquisition: "reward"`, and a unique `rewardOrder` (next unused integer after existing reward cards).
- `game/shared/cardStats.json` contains a `chain_lightning` stat object with: `magicStoneCost` (~40–45), `effect: "chain_lightning"`, `damage` (base full-hit value, ~20–24), `attackRange` (primary target range, ~8–10), `chainRadius: 5`, `maxChainTargets: 2`, `specialEffect: "chain_lightning"`.
- Server and client merged `CARD_DEFS.chain_lightning` both resolve with the expected fields (shared JSON merge — no drift).
- `SHOP_CARD_POOL` includes `chain_lightning` via the `acquisition: "reward"` → `VICTORY_REWARD_ROTATION` path in `game/server/config.js`.
- `game/client/cards.js` `CARD_ACCENT_STYLE.chain_lightning` has a lightning-themed color (e.g. `#38bdf8` / sky-cyan) and icon (e.g. `⚡`).
- Card-count / sync tests remain green (`card_sync`, `cards.test.js`, `new_card_pack_definitions.test.js`).

## Technical Specs

- **`game/shared/cardDefs.json`**: add the `chain_lightning` identity stub near other spells.
- **`game/shared/cardStats.json`**: add gameplay stats as above. `maxChainTargets: 2` means two chain bounces after the primary (up to three distinct enemies total).
- **`game/client/cards.js`**: add `chain_lightning` to `CARD_ACCENT_STYLE` only (stats come from shared JSON merge). Do **not** add combat logic or renderers here.
- Do **not** modify `game/server/cardEffects.js`, `game/server/simulation.js`, or `game/client/cardRenderers.js` in this sub-ticket.

## Verification: code
