# 02 — Derive shop and victory-reward pools from CARD_DEFS tags

Remove the hand-curated `VICTORY_REWARD_ROTATION` and `SHOP_CARD_POOL` arrays from `game/server/config.js` and compute them at module load from `game/shared/cardDefs.json` acquisition tags. This inverts today's `SHOP_CARD_POOL.filter(id => CARD_DEFS[id])` pattern — the pool is authoritative from card defs, not a separate list filtered against defs.

## Acceptance Criteria

- `game/server/config.js` no longer contains hardcoded card-id arrays for `VICTORY_REWARD_ROTATION` or `SHOP_CARD_POOL`.
- `VICTORY_REWARD_ROTATION` is derived as all cards with `acquisition === 'reward'`, sorted ascending by `rewardOrder`.
- `SHOP_CARD_POOL` is derived as all cards with `acquisition === 'reward'` or `acquisition === 'shop'` (preserving today's semantics: reward cards appear in both rotation and shop; `telepipe` is shop-only).
- Derived arrays are exported from `config.js` with the same export names so existing imports in `progression.js`, `index.js`, and tests keep working.
- `pickShopOffer` and `refreshShopOffer` in `game/server/progression.js` use `SHOP_CARD_POOL` directly without `.filter((id) => CARD_DEFS[id])` (the redundant CARD_DEFS guard is removed).
- `VICTORY_REWARD_ROTATION` length is 26 (18 legacy + 8 newly tagged reward cards from sub-ticket 01).
- `SHOP_CARD_POOL` length is 27 (26 reward + `telepipe` shop-only).
- `pnpm test:quick` passes.

## Technical Specs

- **`game/server/config.js`** — `require('../shared/cardDefs.json')`; build `VICTORY_REWARD_ROTATION` via filter + sort on `rewardOrder`; build `SHOP_CARD_POOL` as `[...VICTORY_REWARD_ROTATION, ...shopOnlyIds]` where `shopOnlyIds` are cards tagged `shop` but not `reward` (currently just `telepipe`). Optionally assert every derived id exists as a key in cardDefs.json.
- **`game/server/progression.js`** — Remove `.filter((id) => CARD_DEFS[id])` from `pickShopOffer` (line ~717) and `.find((id) => CARD_DEFS[id])` fallback in `refreshShopOffer` (line ~739); use the derived pool as-is.
- **`game/server/test/new_card_pack.test.js`**, **`game/server/test/aegis_sentinel.test.js`** — Existing `SHOP_CARD_POOL` containment assertions should still pass without edits (pools grow, not shrink).

## Verification: code
