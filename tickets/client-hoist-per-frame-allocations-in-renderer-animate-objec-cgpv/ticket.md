# Client: hoist per-frame allocations in renderer animate() (Object.entries, Sets, template strings)

## Difficulty: easy

## Goal

Every frame allocates Object.entries(gs.players) twice (game/client/renderer.js:6187,6412), new Set(gs.enemies.map(...)) plus the minion equivalent (renderer.js:6216-6240), a cosmeticSignature template string per player, and {slowedUntil,x,z} literals per player for slow/burn indicators (renderer.js:6411-6423,6642); updateDamageNumbers allocates a Vector3 per call (renderer.js:3021-3025). Steady GC pressure at 60fps scaling with entity count. Fix: hoist reusable Sets/Vector3s, iterate with Object.keys/for-in, cache the cosmetic signature on userData and only recompute when the snapshot object identity changes. Coordinate with autogame-1t90 (renderer split) — do this first or as part of it. Found in code review 2026-06-09.

## Acceptance Criteria

- No new Set/Object.entries/template-string allocations per frame in the animate() entity loops; rendering behavior unchanged (existing renderer tests pass)

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
