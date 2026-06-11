# Cleanup nits from 321-anim-solar-edge

> **Staleness note.** This follow-up ticket was written against commit
> `968c6b05` (2026-06-11). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `321-anim-solar-edge`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Dead-branch THREE.IcosahedronGeometry guard in spawnSolarEdgeImpactFlourish
In `game/client/renderer.js`, ember geometry is chosen via
`new THREE.IcosahedronGeometry ? new THREE.IcosahedronGeometry(...) : new THREE.SphereGeometry(...)`.
`THREE.IcosahedronGeometry` is always defined in the bundled THREE build, so the
`SphereGeometry` fallback is unreachable dead code and the `new ... ?` truthiness
check on a constructor is misleading. Simplify to a direct `new THREE.IcosahedronGeometry(0.07, 0)`.
### Acceptance Criteria
- Ember geometry created without the ternary/constructor-truthiness guard.
- `vfx-primitives.test.js` and `cardRenderers.test.js` still pass.
