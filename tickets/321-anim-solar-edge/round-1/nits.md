## Dead-branch THREE.IcosahedronGeometry guard in spawnSolarEdgeImpactFlourish
In `game/client/renderer.js`, ember geometry is chosen via
`new THREE.IcosahedronGeometry ? new THREE.IcosahedronGeometry(...) : new THREE.SphereGeometry(...)`.
`THREE.IcosahedronGeometry` is always defined in the bundled THREE build, so the
`SphereGeometry` fallback is unreachable dead code and the `new ... ?` truthiness
check on a constructor is misleading. Simplify to a direct `new THREE.IcosahedronGeometry(0.07, 0)`.
### Acceptance Criteria
- Ember geometry created without the ternary/constructor-truthiness guard.
- `vfx-primitives.test.js` and `cardRenderers.test.js` still pass.
