# 02-add-card-def-and-shop-pool

Add the `permafrost_lance` game-definition to `CARD_DEFS` in `game/server/progression.js` and register it in `SHOP_CARD_POOL` in `game/server/config.js` so the card is obtainable in-game.

## Acceptance Criteria

- `CARD_DEFS.permafrost_lance` exists in `game/server/progression.js` with these exact stats:
  - `magicStoneCost: 30`
  - `damage: 8`
  - `radius: 6`
  - `freezeDurationMs: 2000`
  - `effect: 'frost_nova'` (reuses existing frost_nova effect branch)
  - spreads `CARD_IDENTITY.permafrost_lance` for id/name/type/charges
- `permafrost_lance` is added to `SHOP_CARD_POOL` in `game/server/config.js` (append to the array or add to `VICTORY_REWARD_ROTATION`).
- Existing `cardEffects.js` freeze branch at line ~458 already handles `effect === 'frost_nova'` — no changes needed there.
- No other files require modification.

## Technical Specs

- **File:** `game/server/progression.js` — add `permafrost_lance` entry in `CARD_DEFS` object (place near `frost_nova` / `glacier_collapse` for readability):
  ```js
  permafrost_lance: {
    ...CARD_IDENTITY.permafrost_lance,
    magicStoneCost: 30,
    effect: 'frost_nova',
    damage: 8,
    radius: 6,
    freezeDurationMs: 2000,
    specialEffect: 'freeze',
  },
  ```
- **File:** `game/server/config.js` — add `'permafrost_lance'` to `VICTORY_REWARD_ROTATION` array (or directly to `SHOP_CARD_POOL`).

## Verification: code
