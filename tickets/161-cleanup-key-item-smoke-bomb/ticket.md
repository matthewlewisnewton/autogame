# Cleanup nits from 128-key-item-smoke-bomb

> **Staleness note.** This follow-up ticket was written against commit
> `1c40881` (2026-06-02). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `128-key-item-smoke-bomb`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Agent-guided capture for Smoke Veil VFX

Round-1 browser capture used the generic fallback lobby/movement plan and never equipped or cast `smoke_bomb`, so screenshots do not show the smoke disc. A dedicated `?debugScenario=smoke-bomb-ready` capture step (cast key item, hold still, screenshot) would give visual regression signal for client VFX.

### Acceptance Criteria
- Harness capture plan includes a step that applies `smoke-bomb-ready` or casts Smoke Veil in gameplay and saves a screenshot showing the grey fog disc at the cast point.
- `metrics.json` remains `ok: true` with empty `pageerrors`.

## Client unit test for triggerSmokeVFX lifecycle

`triggerSmokeVFX` in `renderer.js` manages expand/fade/dispose timing but has no client test (unlike heal/shield patterns elsewhere). A small vitest with mocked `THREE`/`scene` could assert geometry placement at cast coordinates and cleanup after duration.

### Acceptance Criteria
- Test calls `triggerSmokeVFX({ x, z }, radius, playerId)` and verifies mesh position matches cast point (not player follow).
- Test verifies `disposeSmokeVFXEntry` removes mesh/material after animation completes or on replace.
