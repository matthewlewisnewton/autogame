# 03 — Card acquisition reachability test

Add an automated guard so new cards cannot silently ship without an acquisition path. Every card in `CARD_DEFS` must be reachable through at least one of: starter deck, shop/reward pool, enemy drop table, or evolution from a reachable base — unless it is explicitly tagged `drop-only`.

## Acceptance Criteria

- New test file `game/server/test/card_acquisition.test.js` covers reachability for all 42 `CARD_DEFS` keys.
- A card is **reachable** when any of these hold:
  - `acquisition === 'starter'`, or the id appears in `STARTING_DECK_IDS` (covers dual-path cards like `flame_blade` tagged `reward` but also in the starter deck)
  - `acquisition === 'reward'` and the id appears in derived `VICTORY_REWARD_ROTATION`
  - `acquisition === 'shop'` and the id appears in derived `SHOP_CARD_POOL`
  - `acquisition === 'drop-only'` and the id appears as a value in `ENEMY_CARD_DROPS`
  - No `acquisition` field and the id is a value in `EVOLUTION_TRANSFORMS` whose base key is reachable
- A card tagged `drop-only` that is **not** in `ENEMY_CARD_DROPS` fails the test (drop-only must mean a real drop path).
- Cards tagged `starter`, `reward`, or `shop` must **not** rely on evolution-only reachability (they are directly obtainable).
- Test fails if any card lacks both a valid direct tag and a reachable evolution chain.
- Test asserts the eight formerly-unreachable cards (`mana_prism`, `harvesting_scythe`, `deck_sifter`, `sacrificial_altar`, `battery_automaton`, `chrono_trigger`, `spike_trap`, `mirror_ward`) are reachable via `reward` pool membership.
- `pnpm test:quick` passes.

## Technical Specs

- **`game/server/test/card_acquisition.test.js`** (new) — Import `CARD_DEFS`, `STARTING_DECK_IDS`, `EVOLUTION_TRANSFORMS` from `../progression.js` (or `../index.js`); import `VICTORY_REWARD_ROTATION`, `SHOP_CARD_POOL`, `ENEMY_CARD_DROPS` from `../config.js`; import raw identity from `../../shared/cardDefs.json` for `acquisition` tags. Implement a `isCardReachable(cardId, visited)` helper that walks evolution bases recursively with cycle protection.
- **`game/client/test/cards.test.js`** — No changes required unless a test hardcodes unreachable-card expectations; update only if broken by prior sub-tickets.

## Verification: code
