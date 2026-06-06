# 02-boss-scale-distinction

Increase the size gap between stage bosses and trash enemies so the boss is instantly readable as "the big one". Current boss sizes (radius/height) are only modestly larger than grunts (0.5/1.0): `miniboss` 0.8/1.8, `annex_overseer` 0.95/2.0, `arena_champion` 1.2/2.8, `spire_warden` 0.9/2.0. Boost each boss to a more commanding scale while keeping the hierarchy (arena_champion ≥ spire_warden ≈ annex_overseer > miniboss).

## Acceptance Criteria

- All four stage boss entries in `ENEMY_GEOMETRY` have increased `radius` and/or `height` values compared to current
- Boss sizes maintain a clear hierarchy: `arena_champion` is the largest, `miniboss` is the smallest boss (but still noticeably larger than `grunt`)
- Minimum boss scale: radius ≥ 1.0, height ≥ 2.2 for all four bosses (currently `miniboss` radius is only 0.8)
- Trash enemy sizes (`grunt`, `skirmisher`, `spawner`) are unchanged
- Tests pass (`pnpm test`)

## Technical Specs

- **File:** `game/client/renderer.js` — `ENEMY_GEOMETRY` table (lines ~352-359)
- Suggested new values (adjust to taste, must satisfy min thresholds):
  - `miniboss`: radius 1.0, height 2.2
  - `annex_overseer`: radius 1.1, height 2.4
  - `spire_warden`: radius 1.1, height 2.4
  - `arena_champion`: radius 1.4, height 3.0
- No server changes; no new files

## Verification: code
