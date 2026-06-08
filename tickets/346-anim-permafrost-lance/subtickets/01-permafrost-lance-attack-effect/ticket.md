# Permafrost Lance attack-effect VFX primitive

Add a dedicated `permafrost_lance` branch to `spawnAttackEffect` in `renderer.js` so the card can spawn an elongated crystalline ice lance mesh (not the generic cone wedge or the `ice_ball` sphere). This primitive is the visual foundation for the polished Permafrost Lance cast — a forward-thrusting frost spear that reads distinctly from Cryo Burst's radial nova.

## Acceptance Criteria

- `spawnAttackEffect(origin, direction, { effect: 'permafrost_lance', range, color, emissive })` in `game/client/renderer.js` creates a visible elongated lance mesh (e.g. tapered box or cone oriented along `direction`) with icy cyan/white materials (`#67e8f9` / `#38bdf8` family), not a sphere or ground cone wedge.
- The effect travels `range` world units along `direction` over `style.duration ?? ATTACK_EFFECT_DURATION` (600 ms default), using the same position-interpolation / cleanup path as `fireball` and `ice_ball` projectile effects.
- The active-effect entry is distinguishable in tests (e.g. `effect === 'permafrost_lance'` flag on the pushed effect object, or a dedicated geometry aspect ratio assertion).
- `game/client/test/vfx-primitives.test.js` adds a smoke test that spawns the lance effect, asserts it enters `getActiveEffects()`, and cleans up after `updateAttackEffects()` when past duration.
- No changes to other `spawnAttackEffect` branches or unrelated card renderers.

## Technical Specs

- **`game/client/renderer.js`**: inside `spawnAttackEffect`, add an `if (effect === 'permafrost_lance')` branch before the default cone-wedge fallback (~line 4277). Use `THREE` geometry that reads as a spear/lance (elongated along Z before `rotation.y = Math.atan2(nx, nz)`), with `MeshStandardMaterial` using `style.color` / `style.emissive` and moderate emissive intensity. Push to `activeEffects` with `origin`, `direction`, `range`, `createdAt`, `duration`, and an `effect: 'permafrost_lance'` marker.
- **`game/client/test/vfx-primitives.test.js`**: import `spawnAttackEffect` (if not already), spawn with `{ effect: 'permafrost_lance', range: 6, color: 0x67e8f9, emissive: 0x38bdf8 }`, assert one new active effect, verify cleanup.
- Do **not** modify `cardRenderers.js` in this sub-ticket (owned by sub-ticket 02).

## Verification: code
