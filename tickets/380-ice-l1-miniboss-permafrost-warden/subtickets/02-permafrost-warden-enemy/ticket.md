# 02 — Permafrost Warden enemy type

Introduce a distinct ice-cavern stage boss enemy (`permafrost_warden`) separate from the generic `miniboss` Vault Warden and the ranged `glacial_thrower`, with its own stats, display metadata, loot tables, and party-size HP scaling.

## Acceptance Criteria

- `ENEMY_DEFS.permafrost_warden` exists with display name **Permafrost Warden**, a non-empty `description`, `surfacedStats`, and combat behavior distinct from `miniboss` and `glacial_thrower` (e.g. radial or cone melee tuned for ice-band pressure — not `ice_ball` projectile).
- Baseline `hp` sits in the stage-boss band used by other level bosses (300–420); stats are tuned so a full-HP boss can be defeated within the 180s `defeatBoss` validation window at driver attack DPS.
- `spawnEnemy(…, 'permafrost_warden')` succeeds; spawned enemies expose the new type and baseline stats from `ENEMY_DEFS`.
- Party-size HP scaling at spawn (ticket 270 pattern) applies to `permafrost_warden` the same way it applies to `miniboss` and `spire_warden`: baseline for 1–4 players, scaled `hp`/`maxHp` for 5–16, fixed at spawn.
- `ENEMY_CARD_DROPS` and `ENEMY_MS_DROPS` include `permafrost_warden` entries with boss-tier rewards (at least as generous as `miniboss`).
- `buildEnemyDisplayCatalog()` includes `permafrost_warden` with `name`, `description`, and surfaced stat values for the lock-on panel (tickets 251/252).
- Automated tests cover def registration, spawn, scaling, drop lookup, and display catalog surface; `pnpm test:quick` passes.

## Technical Specs

- **`game/server/simulation.js`** — Add `permafrost_warden` to `ENEMY_DEFS` with ice-themed combat tuning and `surfacedStats` (e.g. `hp`, `attackDamage`, `attackStyle`, `attackRange`).
- **`game/server/config.js`** — Add `permafrost_warden` to `ENEMY_CARD_DROPS` and `ENEMY_MS_DROPS`.
- **`game/server/progression.js`** — Extend the spawn-time HP scaling branch in `spawnEnemy()` to include `permafrost_warden` (reuse `difficultyScaleFactor` + `DIFFICULTY_MINIBOSS_HP_PER_PLAYER`).
- **`game/server/test/permafrost_warden.test.js`** (new, mirror `spire_warden.test.js`) — Assert def metadata, spawn, scaling at 5+ players, and drop lookup.
- **`game/server/test/enemy_display_catalog.test.js`** and **`game/server/test/server.test.js`** (`ENEMY_DEFS` describe) — Include `permafrost_warden`.
- **`game/server/test/miniboss_hp_scaling.test.js`** — Add `permafrost_warden` to the scaled-type set if that file enumerates boss types.
- Depends on sub-ticket 01 only for sequencing; boss type is testable via direct `spawnEnemy` without quest wiring.

## Verification: code
