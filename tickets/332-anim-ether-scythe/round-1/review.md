# Senior Review: 332-anim-ether-scythe

## Runtime health

PASS. The captured run in `metrics.json` reports `"ok": true`, clean server/client startup, a connected playable scene, and an empty `pageerrors` array. `pageerrors.json` is empty. `console.log` contains only normal Vite connection and scene initialization messages; `client.log` only adds benign THREE deprecation and Vite WebSocket close noise. No uncaught page errors or fatal game-code errors were present.

## Acceptance criteria findings

### Ether Scythe visual matches its name/theme

PASS. `game/client/cardRenderers.js` gives `harvesting_scythe` its own scythe-specific styling within the shared weapon swing renderer: ether-green fill, spectral-violet emissive edge, wide sweep, lingering spectral decal, and soul-wisp bursts from struck enemies. This is visually distinct from the steel and fire blade styles and reads as an ethereal harvest weapon rather than a generic slash.

### Timing and server effect sync

PASS. The server weapon path in `game/server/cardEffects.js` resolves weapon hits with `attackRange` and `attackConeAngle` and emits both fields on `CARD_USED`. `harvesting_scythe` is overlaid server-side with `attackConeAngle: Math.PI`; the renderer opts this card into using the payload's `attackConeAngle` and `attackRange` for the visible sweep and decal placement, falling back only when older/minion-like payloads omit those fields. The swing renders on `cardUsed`, which is the server resolution event for non-windup Ether Scythe, so there is no extra deferred client timing that would drift from damage application.

### Scope, performance, and integration

PASS. The implementation is narrowly scoped to `game/client/cardRenderers.js`, renderer tests, and a debug scenario registration. The new visual work composes existing primitives (`spawnAttackEffect`, `spawnParticleBurst`, `spawnImpactDecal`) and is guarded for missing optional helpers or missing enemy meshes, so it should degrade cleanly and not introduce broad rendering or performance risk.

### Client test coverage

PASS. `game/client/test/cardRenderers.test.js` covers the scythe theme, server cone/range sync, fallback behavior, sibling blade isolation, hit-wisp behavior, and graceful degradation. The round coverage log shows the full suite passed: 175 test files and 2489 tests.

### Design and foundation consistency

PASS. The change preserves the design document's active card-combat model and the requirements baseline: the game still starts, renders a 3D scene, connects client/server, shows multiplayer state, and accepts synchronized movement in the captured flow. Ether Scythe remains an earnable weapon reward card and no core combat or progression invariant is weakened.

### Debug scenarios

PASS. The added `harvesting-scythe-combat` debug scenario is registered through the existing debug scenario path and remains gated by the existing local/dev `debugScenario` mechanism. It only creates a QA shortcut to a normally reachable state: a player in a normal run with the earnable `harvesting_scythe` in hand. It does not bypass normal `useCard` validation, server hit resolution, net replication, or the client `cardUsed` renderer path.

## Remaining gaps

None.

VERDICT: PASS
