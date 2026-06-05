# 02 — Annex Overseer boss enemy

Introduce a rooms-specific stage boss enemy type with distinct combat mechanics, separate from the arena trial warden (`miniboss` cone striker).

## Acceptance Criteria

- `ENEMY_DEFS.annex_overseer` exists with display name **Annex Overseer**, surfaced stats, and combat behavior distinct from `miniboss` (e.g. radial `attackStyle` with tuned windup/range/damage — area denial rather than cone reach).
- `spawnEnemy(…, 'annex_overseer')` succeeds; party-size HP scaling (ticket 270 pattern) applies to `annex_overseer` the same way it applies to `miniboss` at spawn time.
- Loot/card drop hooks resolve for `annex_overseer` (currency, magic stones, card drop) without falling through to unknown-type errors.
- Client registry renders `annex_overseer` with a visually distinct mesh/attack indicator (reuse GLB if appropriate, but palette/scale must differ from generic `miniboss`).
- Vitest covers stat surface, spawn, HP scaling at 5+ players, and at least one attack-style behavior assertion mirroring existing enemy-type tests.

## Technical Specs

- **`game/server/simulation.js`** — Add `annex_overseer` to `ENEMY_DEFS` (name, description, hp, speeds, attackDamage, attackWindupMs, attackStyle, attackRange/cone fields as needed).
- **`game/server/progression.js`** — Extend miniboss HP scaling guard to include `annex_overseer` (keep single scaling path; do not duplicate factor math).
- **`game/server/progression.js` or existing drop helpers** — Wire currency/magic-stone/card drop tables for the new type (follow `miniboss` reward tier unless design calls for a rooms-specific card).
- **`game/client/renderer.js`** (+ **`game/client/models.js`** if using a model path) — Register mesh footprint, attack telegraph, and lock-on metadata for `annex_overseer`.
- **`game/server/test/server.test.js`** or new **`game/server/test/annex_overseer.test.js`** — Spawn, scaling, and attack-style cases.
- **`game/client/test/renderer-registry-normalize.test.js`** (or companion) — Registry entries for the new type.
- Depends on sub-ticket 01 only for narrative fit; boss type is testable via direct `spawnEnemy` without quest wiring.

## Verification: code
