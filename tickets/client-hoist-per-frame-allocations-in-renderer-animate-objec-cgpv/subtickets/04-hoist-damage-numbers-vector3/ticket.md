# Hoist reusable Vector3 in updateDamageNumbers

`updateDamageNumbers()` allocates `new THREE.Vector3()` on every call (once per `animate()` frame). Hoist a single module-scoped Vector3 reused for world-to-screen projection so the damage-number overlay path stops creating garbage each frame.

## Acceptance Criteria

- `updateDamageNumbers` no longer contains `new THREE.Vector3()` on the per-frame path
- A module-level reusable Vector3 (e.g. `_damageNumberProjVec`) is mutated via `.set(...)` inside the existing per-number loop
- Floating damage numbers still project to the correct screen position, fade out, and are removed after their duration
- `pnpm test:quick` passes; `main.test.js` damage-number coverage remains green

## Technical Specs

- **File:** `game/client/renderer.js`
  - Add a module-level `const _damageNumberProjVec = new THREE.Vector3()` near the damage-number state (`damageNumbers` array)
  - In `updateDamageNumbers()` (~line 3523): remove the inner `const vec = new THREE.Vector3()` and use `_damageNumberProjVec.set(...)` / `.project(camera)` instead
  - Do not change `spawnDamageNumber` or the `damageNumbers` entry shape

## Verification: code
