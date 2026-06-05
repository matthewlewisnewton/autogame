# 02 — Summit Warden enemy type

Introduce a distinct spire summit boss enemy (`spire_warden`) separate from the generic `miniboss` Vault Warden, with its own stats, display metadata, loot tables, and party-size HP scaling.

## Acceptance Criteria

- `ENEMY_DEFS` includes `spire_warden` with spire-themed `name`/`description` (e.g. "Summit Warden") and combat stats clearly different from `miniboss` (e.g. higher baseline HP and/or distinct attack tuning).
- `spawnEnemy(…, 'spire_warden')` succeeds; spawned enemies expose the new type and baseline stats from `ENEMY_DEFS`.
- Party-size HP scaling at spawn (ticket 270) applies to `spire_warden` the same way it does for `miniboss`: baseline for 1–4 players, scaled `hp`/`maxHp` for 5–16, fixed at spawn (not retroactive).
- `ENEMY_CARD_DROPS` and `ENEMY_MS_DROPS` include `spire_warden` entries with boss-tier rewards (at least as generous as `miniboss`).
- Display catalog (`enemyDisplay.js` / `enemy_display_catalog.test.js`) and client model registry expose `spire_warden` (may reuse `/models/miniboss.glb` as placeholder).
- Automated tests cover def registration, spawn, scaling, and drop lookup; `pnpm test:quick` passes.

## Technical Specs

- **`game/server/simulation.js`** — Add `spire_warden` to `ENEMY_DEFS` with tuned stats and `surfacedStats`.
- **`game/server/config.js`** — Add `spire_warden` to `ENEMY_CARD_DROPS` and `ENEMY_MS_DROPS`.
- **`game/server/progression.js`** — Extend the spawn-time HP scaling branch in `spawnEnemy()` to include `spire_warden` (reuse `difficultyScaleFactor` + `DIFFICULTY_MINIBOSS_HP_PER_PLAYER`; do not duplicate scaling logic).
- **`game/client/models.js`** (+ **`game/client/test/models-registry.test.js`**) — Register model path for `spire_warden` (placeholder `miniboss.glb` acceptable).
- **`game/server/test/miniboss_hp_scaling.test.js`** (or new `spire_warden.test.js`) — Assert baseline and scaled HP for `spire_warden` at spawn.
- **`game/server/test/enemy_display_catalog.test.js`** and **`game/server/test/server.test.js`** (`ENEMY_DEFS` describe) — Include `spire_warden`.
- Depends on sub-ticket 01 only for sequencing; no quest or encounter wiring here.

## Verification: code
