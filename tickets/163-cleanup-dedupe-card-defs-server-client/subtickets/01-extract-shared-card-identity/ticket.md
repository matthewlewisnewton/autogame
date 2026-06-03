# Extract shared card identity subset (server + client single source)

The `id/name/type/charges` identity subset of every card is currently copied
verbatim in both `game/server/progression.js` (`CARD_DEFS`) and
`game/client/cards.js` (`CARD_DEFS`). Move that subset into one shared data
file under `game/shared/` (mirroring `constants.json`/`theme.json`) and have
both `CARD_DEFS` objects derive their identity fields from it, while each side
keeps its own extra fields (server: damage/effect/cooldown/minion stats;
client: rendering hints). After this change there is exactly one literal copy
of each card's id/name/type/charges.

## Acceptance Criteria

- A new shared data file exists under `game/shared/` containing, for all 40
  cards, only the identity subset `{ id, name, type, charges }` and nothing
  else. This is the sole literal definition of those four fields.
- `game/server/progression.js` builds its `CARD_DEFS` by reading the shared
  file and merging in its server-only fields per card; it no longer literally
  re-declares `id`, `name`, `type`, or `charges` for any card.
- `game/client/cards.js` builds its `CARD_DEFS` the same way, reading the
  shared file and merging in its client-only fields; it no longer literally
  re-declares `id`, `name`, `type`, or `charges` for any card.
- The resulting `CARD_DEFS` objects are unchanged in value: the same 40 card
  ids, and for every card the same `id`, `name`, `type`, `charges`, and every
  previously-present server-only / client-only field (e.g. `damage`, `effect`,
  `magicStoneCost`, `specialEffect`, `minionHp`, breath/attack params,
  `isEvolved`, `attackRange`, etc.).
- `game/server/test/card_sync.test.js` still passes (server vs client
  id/name/type/charges remain identical for every card).
- Unrelated structures are NOT changed: `STARTING_DECK_IDS` /
  `createStartingDeck()`, `KEY_ITEM_DEFS`, `DESPERATION_CARD_DEFS`,
  `CARD_SELL_VALUES`, `EVOLUTION_TRANSFORMS`, `CARD_TYPE_STYLE`,
  `CARD_ACCENT_STYLE`.
- `cd game && pnpm test` (server + client suites) passes and the game starts
  and loads cleanly.

## Technical Specs

- **New file `game/shared/cardDefs.json`**: a JSON object keyed by card id; each
  value is `{ "id", "name", "type", "charges" }` only. Populate all 40 cards
  with the exact current values (they are already identical on both sides; the
  `card_sync` test guarantees this). Include the redundant `id` field since
  both `CARD_DEFS` objects and consuming code read `def.id`.
- **`game/server/progression.js`** (CARD_DEFS at ~line 111): add
  `const CARD_IDENTITY = require('../shared/cardDefs.json');` near the other
  `require('../shared/...')` usages, and rewrite each `CARD_DEFS` entry to spread
  the shared identity then its server-only fields, e.g.
  `iron_sword: { ...CARD_IDENTITY.iron_sword, damage: 17 }`. Drop the literal
  `id`/`name`/`type`/`charges` from every entry. `CARD_DEFS` must still be the
  exported object (re-exported through `index.js`).
- **`game/client/cards.js`** (CARD_DEFS at ~line 9): import the shared file as
  JSON following the existing client pattern in `game/client/config.js`
  (`import cardIdentity from '../shared/cardDefs.json' with { type: 'json' };`),
  and rewrite each `CARD_DEFS` entry to spread `cardIdentity[id]` then its
  client-only fields. Drop the literal `id`/`name`/`type`/`charges` from every
  entry. Keep the `export const CARD_DEFS` shape intact (it backs
  `weaponCardIds`/`spellCardIds`/etc. and `getCardDef`).
- Reference patterns for shared-JSON consumption already in the repo:
  server `game/server/config.js` / `game/server/theme.js`
  (`require('../shared/*.json')`) and client `game/client/config.js`
  (`import ... with { type: 'json' }`).
- Do not change any card values, the starting-deck data, or the unrelated
  registries listed in the acceptance criteria.

## Verification: code
