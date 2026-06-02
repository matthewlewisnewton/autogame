# Cleanup nits from 128-key-item-smoke-bomb

> **Staleness note.** This follow-up ticket was written against commit
> `42c800a` (2026-06-02). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `128-key-item-smoke-bomb`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Smoke bomb VFX ignores sloped floor height

The fog cylinder in `triggerSmokeBombVFX` is placed at a fixed `y = SMOKE_BOMB_CLOUD_HEIGHT / 2` (floor at world Y=0). Dungeon rooms with ramped floors use `sampleFloorY(x, z)` elsewhere for player alignment; on slopes the smoke dome may float or clip slightly.

### Acceptance Criteria

- When spawning smoke VFX, position the mesh base using the same floor sampling helper used for player feet at `(smokeBombX, smokeBombZ)`.
- Existing `smoke-bomb-vfx.test.js` still passes; add or adjust one test if floor offset is mocked.

## Agent-guided capture for smoke bomb

Round-1 fallback capture never equips or uses `smoke_bomb`, so harness screenshots cannot catch VFX regressions.

### Acceptance Criteria

- A future capture plan (or `?debugScenario=smoke-bomb-active` on localhost) includes at least one screenshot showing the fog dome while `smokeBombUntil > now`.
- `metrics.json` probe records non-zero `smokeBombUntil` for the local player or an ally.
