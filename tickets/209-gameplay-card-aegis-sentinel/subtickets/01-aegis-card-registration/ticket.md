# Register Aegis Sentinel card data

Add the shared identity stub and mirror `aegis_sentinel` into server and client `CARD_DEFS` with the defensive stats from the parent ticket, and expose the card in the shop rotation. No cast-handler changes in this sub-ticket.

## Acceptance Criteria

- `game/shared/cardDefs.json` includes `aegis_sentinel` with `id`, `name` (e.g. "Aegis Sentinel"), `type: "creature"`, and `charges: 1`.
- `CARD_DEFS.aegis_sentinel` in `game/server/progression.js` spreads the identity and sets: `magicStoneCost: 45`, `damage: 0`, `isEvolved: true`, `specialEffect: 'astral_shield'`, `effect: 'astral_guardian'` (or equivalent keys that target the astral branch), `shieldHp: 30`, `shieldDurationMs: 8000`, `minionHp: 160`, `minionTtl: 30`, `attackDamage: 0`, `taunt: true`.
- `game/client/cards.js` defines a matching `aegis_sentinel` entry (same identity spread and gameplay fields the client already mirrors for peers like `astral_guardian` / `skeleton_knight`).
- `aegis_sentinel` is listed in `SHOP_CARD_POOL` in `game/server/config.js` so `pickShopOffer` can roll it.
- Optional but recommended: add `aegis_sentinel` to `CARD_SELL_VALUES` in `game/server/progression.js` and `CARD_ACCENT_STYLE` in `game/client/cards.js` so shop pricing and deck UI accents are consistent with other evolved cards.

## Technical Specs

- **`game/shared/cardDefs.json`**: new `aegis_sentinel` object; keep alphabetical or pack grouping consistent with neighboring creature entries.
- **`game/server/progression.js`**: add `aegis_sentinel` to the `CARD_DEFS` object near `astral_guardian` / `skeleton_knight`. Reuse `CARD_IDENTITY.aegis_sentinel` via spread. Do not change `cardEffects.js` yet.
- **`game/client/cards.js`**: add `aegis_sentinel` to `CARD_DEFS` and `CARD_ACCENT_STYLE` (suggest a shield-themed icon/color distinct from `astral_guardian`).
- **`game/server/config.js`**: append `'aegis_sentinel'` to `VICTORY_REWARD_ROTATION` or `SHOP_CARD_POOL` (whichever pattern other shop cards use — currently pool is `[...VICTORY_REWARD_ROTATION, 'telepipe']`).

## Verification: code
