# Shared full-stat card source + switch server consumer

Create the single source of truth for full per-card stats, sell values, and
evolution transforms as shared JSON, then rewire the SERVER (`progression.js`)
to consume it. Client stays untouched this round (it still spreads identity from
the same shared file, so no behavior change). Land the data + server switch
first; the client switch and expanded tests follow in later sub-tickets.

## Acceptance Criteria

- `game/shared/cardDefs.json` is extended so each card entry carries the full
  set of *shared* (client-relevant) stat fields in addition to identity —
  e.g. `magicStoneCost`, `damage`, `effect`, `specialEffect`, `isEvolved`,
  `taunt`, `attackRange`, `healAmount`, `magicStoneRestore`, `target`,
  `adjacentChargeRestore`, `minionHp` — using the EXACT values currently in the
  server `CARD_DEFS` (`progression.js` L115-478). Only JSON-safe primitives;
  no functions/expressions.
- Two new shared JSON files exist as single sources:
  `game/shared/cardSellValues.json` and `game/shared/evolutionTransforms.json`.
  `cardSellValues.json` is the RECONCILED union of the two drifted copies — it
  MUST include both `aegis_sentinel: 22` (server-only today) and
  `arcane_bolt: 8` (client-only today), plus every other existing entry.
- Server `CARD_DEFS` (`progression.js`) still spreads `...CARD_IDENTITY.<id>`
  for every card; the per-card object literals are reduced to ONLY server-only
  fields (e.g. `minionTtl`, `breath*`, `attack*`, `dot*`, `shield*`,
  `knockbackStrength`, and `Math.*`/`TICK_RATE` expressions). Shared fields that
  now come from the shared source are removed from the overlay. Resulting server
  `CARD_DEFS[id]` objects are byte-for-byte equal to before for every card.
- Server `CARD_SELL_VALUES` and `EVOLUTION_TRANSFORMS` in `progression.js` are
  replaced by importing the new shared JSON files (no inline literal map).
- `getCardSellValue` keeps its computed fallback (`progression.js` ~L700-710),
  unchanged in behavior.
- `cd game && pnpm test` passes (all existing server tests, including
  `card_sync`, `aegis_sentinel`, `card_evolution`, `new_card_pack`).

## Technical Specs

- `game/shared/cardDefs.json` — extend every entry from identity-only to the
  full shared stat object. Cross-check each field/value against the matching
  server `CARD_DEFS` entry so server behavior is unchanged after the overlay is
  thinned.
- `game/shared/cardSellValues.json` (new) — flat `{ cardId: number }` map; the
  reconciled superset of `progression.js` `CARD_SELL_VALUES` (L670-698) and
  `client/cards.js` `CARD_SELL_VALUES` (L281-309).
- `game/shared/evolutionTransforms.json` (new) — flat `{ fromId: toId }` map
  copied from `progression.js` `EVOLUTION_TRANSFORMS` (L653-668).
- `game/server/progression.js` — `require` the two new JSON files; replace the
  inline `EVOLUTION_TRANSFORMS` and `CARD_SELL_VALUES` consts with the imports
  (re-export under the same names so `index.js` exports keep working); thin each
  `CARD_DEFS` overlay to server-only fields. `CARD_IDENTITY` import stays
  (`require('../shared/cardDefs.json')`).
- Do NOT touch `client/cards.js` in this sub-ticket beyond what the shared JSON
  expansion implies automatically (it already spreads `cardIdentity`).

## Verification: code
