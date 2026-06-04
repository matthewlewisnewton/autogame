# Switch client consumer to the shared source

Rewire `client/cards.js` so its `CARD_DEFS`, `CARD_SELL_VALUES`, and
`EVOLUTION_TRANSFORMS` come from the shared JSON single sources created in
sub-ticket 01, removing the partial hand-retyped stat copy and the drifted
duplicate maps. After this round both sides are single-sourced.

## Acceptance Criteria

- Each `client/cards.js` `CARD_DEFS` entry is reduced to `{ ...cardIdentity.<id> }`
  (plus any genuinely client-only rendering hint not present in the shared
  source). All stat literals that now live in the shared `cardDefs.json`
  (e.g. `magicStoneCost`, `damage`, `effect`, `specialEffect`, `isEvolved`,
  `taunt`, `attackRange`, `healAmount`, `magicStoneRestore`, `target`,
  `adjacentChargeRestore`, `minionHp`) are deleted from the inline literals.
- `client/cards.js` `CARD_SELL_VALUES` is replaced by importing
  `game/shared/cardSellValues.json` (re-exported under the same name). The old
  inline map — which was missing `aegis_sentinel` and carried a client-only
  `arcane_bolt` — is removed; both ids now resolve from the shared source.
- `client/cards.js` `EVOLUTION_TRANSFORMS` is replaced by importing
  `game/shared/evolutionTransforms.json` (re-exported under the same name).
- `getCardSellValue` in `client/cards.js` keeps its computed fallback unchanged.
- `CARD_ACCENT_STYLE`, `DESPERATION_CARD_DEFS`, `createStartingDeck`, the
  type-id Sets, and all existing exports remain present and unchanged in name.
- `cd game && pnpm test` passes, including `client/test/cards.test.js`,
  `attune-preview.test.js`, and the server↔client `card_sync` test.

## Technical Specs

- `game/client/cards.js` — add JSON imports
  (`import cardSellValues from '../shared/cardSellValues.json' with { type: 'json' }`
  and likewise for `evolutionTransforms.json`); replace the inline
  `CARD_SELL_VALUES` (L281-309) and `EVOLUTION_TRANSFORMS` (L264-279) consts with
  `export const ... = cardSellValues;` / `= evolutionTransforms;`; strip the
  duplicated stat fields from every `CARD_DEFS` entry (L13-246) so they spread
  only from `cardIdentity`.
- Do NOT change server files in this sub-ticket.

## Verification: code
