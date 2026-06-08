# 01 — Evolved Ether Scythe card data and evolution transform

The base Ether Scythe (`harvesting_scythe`) has no evolution entry yet. Add the evolved variant (`reapers_scythe`, display name **Reaper's Scythe**) to the shared card catalogs and wire `harvesting_scythe → reapers_scythe` into the evolution transform table. The evolved card keeps the harvest/MS economy identity and adds conservative **kill-only** rewards via new stat fields (`currencyOnKill`, `healOnKill`); the base card stats stay unchanged.

## Acceptance Criteria

- `game/shared/cardEconomy.json` `evolutionTransforms` includes `"harvesting_scythe": "reapers_scythe"`.
- `game/shared/cardDefs.json` defines `reapers_scythe` as a `weapon` with `isEvolved`-appropriate identity (no `acquisition` tag — evolution-only, same pattern as `steel_claymore`).
- `game/shared/cardStats.json` defines `reapers_scythe` with `isEvolved: true`, combat stats at least as strong as base (`damage` ≥ 12, retain `magicStoneOnHit` / `magicStoneOnKill`), plus conservative kill rewards: `currencyOnKill` (small integer, e.g. 6) and `healOnKill` (small integer, e.g. 8). **No** `currencyOnHit` / `healOnHit` — rewards are kill-only.
- `harvesting_scythe` stats in `cardStats.json` are unchanged (still `magicStoneOnHit: 5`, `magicStoneOnKill: 15`, no currency/heal fields).
- `cardSellValues` includes a sell price for `reapers_scythe`.
- `game/server/progression.js` `CARD_STAT_OVERLAY` gives `reapers_scythe` the same full-circle `attackConeAngle: Math.PI` as `harvesting_scythe`.
- `game/server/test/card_evolution.test.js` includes a case that evolving a +10 `harvesting_scythe` yields `reapers_scythe`, and the existing “defines every evolved card referenced by the transform table” test passes with the new pair.

## Technical Specs

- **`game/shared/cardEconomy.json`**
  - Add `"harvesting_scythe": "reapers_scythe"` under `evolutionTransforms`.
  - Add `"reapers_scythe": <sell value>` under `cardSellValues` (e.g. 10 — between base scythe 6 and mid-tier evolved weapons).
- **`game/shared/cardDefs.json`**
  - Add entry: `{ "id": "reapers_scythe", "name": "Reaper's Scythe", "type": "weapon", "charges": 3 }` (or 4 if a small charge bump fits the evolution tier).
- **`game/shared/cardStats.json`**
  - Add `reapers_scythe` block with `damage`, `magicStoneOnHit`, `magicStoneOnKill`, `currencyOnKill`, `healOnKill`, `isEvolved: true`, and `specialEffect` (e.g. `"reap"`).
  - Do **not** modify the existing `harvesting_scythe` block.
- **`game/server/progression.js`**
  - Extend `CARD_STAT_OVERLAY` with `reapers_scythe: { attackConeAngle: Math.PI }`.
- **`game/server/test/card_evolution.test.js`**
  - Add `evolves Ether Scythe +10 into Reaper's Scythe` test mirroring the `mana_leach → soul_drain` pattern.
- Do **not** change combat/kill-reward server logic in this sub-ticket — that is sub-ticket 02.

## Verification: code
