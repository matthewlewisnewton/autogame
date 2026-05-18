# Attack Effect Opacity Fade

Fix the attack projectile material so its opacity fade renders correctly by setting `transparent: true` in the `MeshStandardMaterial` constructor, instead of toggling it after creation.

## Acceptance Criteria
- The `MeshStandardMaterial` created in `spawnAttackEffect` is instantiated with `transparent: true` in its constructor options
- The per-frame `material.opacity` reduction in `updateAttackEffects` produces a visible fade-out of the projectile as it ages
- No `material.needsUpdate` workaround is needed because Three.js compiles the correct shader when `transparent: true` is present at construction time
- The effect still auto-removes after its duration (existing behavior preserved)

## Technical Specs
- **File**: `game/client/main.js`
- In `spawnAttackEffect`, change the `MeshStandardMaterial` constructor from:
  `{ color: 0xffdd44, emissive: 0xffaa00, emissiveIntensity: 0.8 }`
  to:
  `{ color: 0xffdd44, emissive: 0xffaa00, emissiveIntensity: 0.8, transparent: true, opacity: 1.0 }`
- Optionally remove the runtime `fx.mesh.material.transparent = lifeRatio < 1.0` line in `updateAttackEffects` since the material is now permanently transparent (the opacity fade alone handles the visual)

## Verification: code
