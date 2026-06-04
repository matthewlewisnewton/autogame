# 02-shop-pool-and-client-render

Add `permafrost_lance` to the shop card pool so it is obtainable in-game, and register client-side rendering metadata (CARD_DEFS entry + accent color/icon) so the card displays correctly in the shop and hand UI.

## Acceptance Criteria

- `permafrost_lance` appears in `SHOP_CARD_POOL` (via `VICTORY_REWARD_ROTATION` in `game/server/config.js`).
- Client `CARD_DEFS` in `game/client/cards.js` includes a `permafrost_lance` entry with `magicStoneCost: 30`, `effect: 'frost_nova'`, `specialEffect: 'freeze'`.
- `CARD_ACCENT_STYLE` in `game/client/cards.js` includes a `permafrost_lance` entry with a frost-themed color (`#67e8f9`) and icon (`❄`).
- Card renders correctly in the shop overlay and hand UI (same visual pipeline as `frost_nova`).

## Technical Specs

- **game/server/config.js** — Add `'permafrost_lance'` to the `VICTORY_REWARD_ROTATION` array (which feeds `SHOP_CARD_POOL`).
- **game/client/cards.js** — Add `permafrost_lance` entry to `CARD_DEFS`:
  ```js
  permafrost_lance: {
    ...cardIdentity.permafrost_lance,
    magicStoneCost: 30,
    effect: 'frost_nova',
    specialEffect: 'freeze',
  },
  ```
- **game/client/cards.js** — Add `permafrost_lance` to `CARD_ACCENT_STYLE`:
  ```js
  permafrost_lance: { color: '#67e8f9', icon: '❄' },
  ```

## Verification: code
