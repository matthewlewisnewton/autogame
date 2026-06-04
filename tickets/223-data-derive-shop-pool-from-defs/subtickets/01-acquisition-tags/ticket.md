# 01 — Add per-card acquisition tags to shared card defs

Add an `acquisition` field to every card identity in `game/shared/cardDefs.json` so each directly obtainable card declares how players can get it (`starter`, `reward`, `shop`, or `drop-only`). Cards only reachable via evolution omit `acquisition`. Review the eight currently-unreachable cards (`mana_prism`, `harvesting_scythe`, `deck_sifter`, `sacrificial_altar`, `battery_automaton`, `chrono_trigger`, `spike_trap`, `mirror_ward`) and tag them `reward` — they were implemented with sell values and tests but never wired into any pool; the omission was unintentional.

## Acceptance Criteria

- Every card entry in `game/shared/cardDefs.json` either has a valid `acquisition` value (`starter` | `reward` | `shop` | `drop-only`) or omits the field when the card is evolution-only (target of `EVOLUTION_TRANSFORMS`, not directly sold or rewarded).
- `iron_sword` is tagged `starter` (starter-only; not in victory rotation). `flame_blade`, `battle_familiar`, and `dungeon_drake` are tagged `reward` — they appear in both the starting deck (`STARTING_DECK_IDS`, unchanged) and the victory rotation; the tag drives pool derivation while `STARTING_DECK_IDS` remains the starter source of truth.
- Cards currently in `VICTORY_REWARD_ROTATION` (config.js lines 37–56) are tagged `reward` and include a numeric `rewardOrder` (0–17) preserving the exact existing rotation sequence.
- `telepipe` is tagged `shop` (shop-only, not in victory rotation).
- The eight previously-unreachable utility/enchantment cards are tagged `reward` with new `rewardOrder` values appended after the existing 18 (orders 18–25).
- `acquisition` and `rewardOrder` flow through to server `CARD_DEFS` and client `CARD_DEFS` via the existing `...CARD_IDENTITY` / `...cardIdentity` spread (no duplicate manual lists).
- `game/client/test/card_sync.test.js` asserts `acquisition` (and `rewardOrder` when present) match between server and client for every card key.
- Hardcoded `VICTORY_REWARD_ROTATION` / `SHOP_CARD_POOL` in `config.js` are unchanged in this sub-ticket (derivation is sub-ticket 02).

## Technical Specs

- **`game/shared/cardDefs.json`** — Add `acquisition` (and `rewardOrder` for reward-tagged cards) to all 42 entries. Evolution-only targets (`steel_claymore`, `magma_greatsword`, `astral_guardian`, `ancient_wyrm`, `excalibur_photon`, `infinite_disk`, `glacier_collapse`, `divine_grace`, `undead_commander`, `thunderbird`, `event_horizon`, `resonance_edge`, `soul_drain`, `inferno_pillar`) omit `acquisition`.
- **`game/server/progression.js`** — No pool logic changes; identity spread already picks up new JSON fields.
- **`game/client/cards.js`** — Same; identity spread picks up new fields.
- **`game/client/test/card_sync.test.js`** — Extend the per-key sync loop to compare `acquisition` and `rewardOrder`.

## Verification: code
