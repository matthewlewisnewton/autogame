# Evolved Soul Reaper card data

Register the evolved Ether Scythe (`soul_reaper`, display name **Soul Reaper**) in the shared card catalogs and client accent metadata. This sub-ticket adds identity, evolution wiring, and kill-reward stat fields only — no combat logic yet.

## Acceptance Criteria

- `game/shared/cardEconomy.json` `evolutionTransforms` maps `harvesting_scythe` → `soul_reaper`.
- `game/shared/cardDefs.json` contains a `soul_reaper` entry: `id: "soul_reaper"`, `name: "Soul Reaper"`, `type: "weapon"`, `charges: 3` (no `acquisition` — evolution-only, same pattern as `steel_claymore` / `soul_drain`).
- `game/shared/cardStats.json` `soul_reaper` stat object includes:
  - `isEvolved: true`
  - `specialEffect: "soul_reap"` (required by `card_evolution.test.js` evolved-card invariant)
  - Base Ether Scythe MS economy preserved: `damage: 12`, `magicStoneOnHit: 5`, `magicStoneOnKill: 15`
  - Conservative kill bonuses: `goldOnKill` (small integer, e.g. 3) and `healOnKill` (small integer, e.g. 5) — **only on the evolved card**, not on `harvesting_scythe`
- `game/shared/cardEconomy.json` `cardSellValues` includes a sell value for `soul_reaper` (e.g. 10).
- `game/server/progression.js` `CARD_STAT_OVERLAY` includes `soul_reaper: { attackConeAngle: Math.PI }` (same wide sweep as base scythe).
- Server and client merged `CARD_DEFS.soul_reaper` resolve with the fields above; `EVOLUTION_TRANSFORMS.harvesting_scythe === 'soul_reaper'` on both sides.
- `game/client/cards.js` `CARD_ACCENT_STYLE.soul_reaper` has a harvest/reap-themed color and icon (e.g. `#a855f7` / `☠`).
- `game/server/test/card_evolution.test.js` includes a focused case: `harvesting_scythe` at grind +10 evolves into `soul_reaper` with `isEvolved: true`.
- `game/client/test/cards.test.js` asserts `soul_reaper` evolved metadata and transform mapping.
- `harvesting_scythe` shared stats remain unchanged (still only `damage`, `magicStoneOnHit`, `magicStoneOnKill` — no `goldOnKill` / `healOnKill`).

## Technical Specs

- **`game/shared/cardDefs.json`**: add `soul_reaper` identity stub after `harvesting_scythe`.
- **`game/shared/cardStats.json`**: add `soul_reaper` stats as above; do **not** modify `harvesting_scythe`.
- **`game/shared/cardEconomy.json`**: add evolution transform and sell value.
- **`game/server/progression.js`**: add `soul_reaper` to `CARD_STAT_OVERLAY` with `attackConeAngle: Math.PI`.
- **`game/client/cards.js`**: add `CARD_ACCENT_STYLE.soul_reaper` only (no combat logic).
- **`game/server/test/card_evolution.test.js`**: add `harvesting_scythe` → `soul_reaper` evolution test (mirror `mana_leach` → `soul_drain` case).
- **`game/client/test/cards.test.js`**: add `soul_reaper` / transform assertions alongside other evolved weapons.
- Do **not** modify `game/server/simulation.js`, `game/server/cardEffects.js`, or existing Ether Scythe integration tests in this sub-ticket.

## Verification: code
