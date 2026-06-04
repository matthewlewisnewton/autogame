# Shared CARD_SELL_VALUES + EVOLUTION_TRANSFORMS single sources

`CARD_SELL_VALUES` and `EVOLUTION_TRANSFORMS` are duplicated in both
`progression.js` and `cards.js` and have already drifted (server has
`aegis_sentinel: 22`, client lacks it; client has `arcane_bolt: 8`, server
lacks it). Make each a single shared source consumed by both sides.

## Acceptance Criteria

- `CARD_SELL_VALUES` lives in one shared source and is imported by both
  `server/progression.js` and `client/cards.js`; neither file defines its own
  copy. The merged map is reconciled so no card is silently dropped (resolve the
  `aegis_sentinel` and `arcane_bolt` drift — keep both entries).
- `EVOLUTION_TRANSFORMS` lives in one shared source and is imported by both
  sides; neither file defines its own copy. (Both current copies are already
  identical — verify and collapse to the single source.)
- `getCardSellValue` retains its computed fallback for ids absent from the
  shared `CARD_SELL_VALUES` (server `progression.js:700-710`, client
  `cards.js:311-321`): `isEvolved` → 15, spell → 12, creature → 10, else → 5.
- All existing re-exports keep their names/shape: server `index.js` still
  re-exports `EVOLUTION_TRANSFORMS`, `CARD_SELL_VALUES`, `getCardSellValue`;
  client `main.js` still imports `EVOLUTION_TRANSFORMS` and `getCardSellValue`
  from `./cards.js`.
- `cd game && pnpm test` passes.

## Technical Specs

- Files: new shared source (e.g. `game/shared/cardEconomy.json` or add to the
  shared stats module), `game/server/progression.js` (L653-710),
  `game/client/cards.js` (L264-321), and re-export sites
  (`server/index.js:211/231/2082/2099`).
- Server `getCardBuyValue` (`progression.js:712-714`) and the
  `EVOLUTION_TRANSFORMS[fromCardId]` evolve path (`progression.js:1104`) must
  keep working unchanged against the shared map.
- Reconcile the drifted entries explicitly: the shared `CARD_SELL_VALUES` must
  contain both `aegis_sentinel` and `arcane_bolt`.

## Verification: code
