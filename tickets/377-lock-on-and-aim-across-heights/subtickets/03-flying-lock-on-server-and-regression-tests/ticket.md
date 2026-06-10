# 03 — Flying lock-on server resolution and regression tests

Confirm server-side lock-on target resolution feeds full 3D aim (including Y) for airborne enemies when the client sends `lockTargetId`, and add regression coverage so height-aware projectile aiming stays wired end-to-end. Depends on sub-tickets 01–02 (client can lock onto elevated targets and send `lockTargetId`).

## Acceptance Criteria

- `resolveProjectileAim` in `game/server/index.js` resolves a `flying: true` enemy with `altitude` (no explicit `y` override) to a non-zero `dirY` when the player is on the floor and the enemy shares `(x, z)`.
- `resolveProjectileAim` still resolves enemies with explicit `enemy.y` elevation (existing `lock-on-elevated-projectile` path unchanged).
- A `flying: true` lock-on target hit test in `height_aware_projectiles.test.js` fires a player projectile card (e.g. `fireball`) with `lockTargetId` at a `void_seraph` or `rime_drifter`-style airborne enemy and asserts damage; flat rotation without `lockTargetId` still misses.
- New debug scenario `lock-on-flying-enemy` in `debugScenarios.js` (registered in `game/server/index.js` scenario list): playing phase, projectile card in hand, one airborne enemy (`flying: true`, `altitude`) directly above the player for harness QA.
- `game/client/main.js` continues to include `lockTargetId: getLockedEnemyId()` on `USE_CARD` emits when lock-on is active (assert in an existing or new client test if not already covered).
- Server + client vitest suites pass (`pnpm test` from `game/`).

## Technical Specs

- `game/server/index.js`:
  - Audit `resolveProjectileAim`; fix only if `getEntityWorldY` is bypassed for airborne enemies missing explicit `y`. Ensure aim uses `{ x, y: getEntityWorldY(enemy), z }` for all live lock targets.
  - Register `'lock-on-flying-enemy'` alongside existing `'lock-on-elevated-projectile'` in the debug scenario allowlist.
- `game/server/debugScenarios.js`:
  - Add `lock-on-flying-enemy` branch: resume playing run, give player a charged projectile card (e.g. `fireball`), spawn one `flying: true` enemy at player `(x, z)` with `altitude` ≥ 3, full HP for one-hit verification.
- `game/server/test/height_aware_projectiles.test.js`:
  - Add `describe('resolveProjectileAim flying lock-on')` with airborne enemy (`flying: true`, `altitude`, layout wired) asserting `dirY > 0`.
  - Add integration case: `handleUseCard` + `lockTargetId` damages airborne enemy on same `(x, z)`.
- `game/client/test/main.test.js` or `lockOn.test.js`:
  - Lightweight assertion that `getLockedEnemyId()` would be included in a `USE_CARD` payload when lock-on is active (mock/spy pattern consistent with existing client tests).

## Verification: code
