# 03-telepipe-portal-animation

Animate the persistent telepipe portal mesh so it reads as an active evacuation portal rather than a static cyan tube. Currently `syncTelepipeMesh()` creates a plain cylinder with a single torus ring — no motion, no particle activity.

## Acceptance Criteria

- Telepipe portal cylinder has a slow vertical shimmer (emissive intensity oscillation ~1 Hz)
- Two orbiting torus rings rotate around the portal at different speeds, giving a "warp tube" feel
- A rising particle column inside the portal (upward-drifting particles using `spawnParticleBurst`-style children, managed as a persistent group)
- Animation is driven in the main render loop (no extra rAF), meshes are properly disposed on portal removal
- No regression: portal still appears at correct position, still disappears when telepipe is cleared

## Technical Specs

- **`game/client/renderer.js`**: In `syncTelepipeMesh()`, replace the static cylinder+ring with an animated group: cylinder with oscillating `emissiveIntensity`, two child torus rings with different rotation speeds, and a small pool of rising particle spheres recycled each frame. Add cleanup in the existing disposal path (geometry/material dispose for all children). Animate in the main render loop near the existing `syncTelepipeMesh()` call.
- **`game/client/test/renderer.test.js`** (or a new test file): Tests for `syncTelepipeMesh` creating/disposing portal group, verifying child count and disposal paths.

## Verification: code
