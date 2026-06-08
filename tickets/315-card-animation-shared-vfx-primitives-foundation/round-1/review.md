## Runtime health

PASS. The captured run loaded and entered gameplay cleanly. `metrics.json` has `"ok": true`, no `harness_failure`, and an empty `pageerrors` array. `console.log` contains only normal Vite connection messages and game startup logs, with no `pageerror` or `[fatal]` entries from game code. The client/server logs show the expected dev server startup and only benign THREE.Clock deprecation / Vite socket-close noise.

## Acceptance criteria

### New shared primitives available and documented

PASS. `game/client/renderer.js` now exports reusable, accent-themeable `spawnParticleBurst`, `spawnProjectileTrail`, `spawnImpactDecal`, and `spawnTelegraphRing` helpers. They all register transient entries in `activeEffects`, update through existing effect lifecycle code, and dispose meshes/materials on expiry. `game/client/main.js` wires all four helpers into `cardRenderCtx`, and `game/client/cardRenderers.js` documents them in the renderer context contract.

### Exemplar card upgrades

PASS. Three exemplar renderers compose the new primitives:

- `fireball` keeps the existing projectile and adds an accent-tinted trail, impact decal, and ember burst.
- `inferno_pillar` keeps the pillar and generic spell ring while adding an accent telegraph ring and ember burst.
- `bulkhead_mauler` keeps its shockwave cone while adding an accent debris burst.

These are scoped to per-card renderer logic and preserve fallback behavior when the new ctx helpers are absent.

### Wind-up charge telegraph for windUpMs cards

PASS. The renderer now derives a normalized charge ratio from `cardWindupUntil` and each card's `windUpMs`, tints the ring/avatar with the casting card accent, grows/brightens the ring during the lockout, and tears it down when `cardUseState` leaves `windup`. This is driven solely by normal server snapshots, so it does not add a debug shortcut or bypass gameplay validation.

### Client tests where feasible

PASS. The coverage log shows all tests passing: 30 files, 418 tests. New focused coverage includes primitive lifecycle/disposal tests, accent override tests, card renderer composition/fallback tests, and wind-up charge ratio/telegraph lifecycle tests.

### No performance regression

PASS. The new primitives allocate on effect spawn, then update existing meshes in `updateAttackEffects` without per-frame allocation. Particle effects honor the existing `particlesEnabled` setting, and all new transient meshes are removed and disposed at expiry. No runtime errors or capture regressions were observed.

## Design and requirements consistency

PASS. The changes are client-side visual polish for card combat and do not alter the lobby/dungeon/card-combat loop described in `game/docs/design.md`. They preserve the foundational requirements in `game/docs/requirements.md`: the captured run renders a 3D scene, connects to the backend, shows multiplayer presence, and updates movement during play.

## Debug scenarios

No development debug scenario was added or changed by this ticket. Existing debug scenario plumbing remains outside the changed behavior.

## Remaining gaps

None.

VERDICT: PASS
