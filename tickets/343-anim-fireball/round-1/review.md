# Senior Review: 343-anim-fireball

## Runtime health

The captured run is healthy. `metrics.json` reports `"ok": true`, the browser reached gameplay with two connected players, `pageerrors` is empty, and `console.log` contains no `pageerror` or `[fatal]` lines from game code. The only notable client log noise is the allowed THREE.Clock deprecation warning and Vite socket-close `EPIPE` during shutdown.

The round directory references screenshot filenames in `metrics.json`, but the image files themselves are not present in the folder. The probes and logs still prove the game started, connected, rendered canvases, entered gameplay, and remained error-free.

## Acceptance criteria findings

### Fireball visual matches name/theme

PASS. `game/client/cardRenderers.js` registers `fireball` to a bespoke `renderFireball` renderer rather than falling back to the generic weapon renderer. It adds a warm orange/red cast flourish, a fireball projectile style, a matching projectile trail, a terminal scorch decal, ember bursts, and per-hit ignite sparks. `game/client/renderer.js` renders the `fireball` effect as a grouped glowing ember core plus translucent flame halo, visually distinct from generic projectile, throw rock, and ice ball effects.

### Timing is synced to server-side effect resolution

PASS. Fireball has no positive `windUpMs`, so there is no 307 charge telegraph to synchronize. The renderer uses `ATTACK_EFFECT_DURATION` consistently for the projectile body, trail, and terminal scorch scheduling, and immediate per-enemy ignite bursts line up with the server's immediate projectile hit and `applyBurning()` resolution. The server payload already carries origin, direction, attack range, hits, and burn state; the renderer consumes those fields without changing gameplay timing.

### DoT or lingering effect representation

PASS. The Fireball renderer adds immediate fire hit feedback at struck enemy meshes, while ongoing burn presentation remains driven by the existing `burningUntil` enemy state in the renderer. That keeps the animation consistent with the server's burning duration instead of inventing a separate client-only timer.

### No performance regression

PASS. The new Fireball projectile uses a small group with two sphere meshes and existing active-effect cleanup. The added primitives are short-lived and follow existing VFX patterns; grouped meshes are disposed through the existing recursive effect disposal helper.

### Client test coverage where feasible

PASS. `coverage.log` shows the vitest run completed successfully: 32 test files and 504 tests passed. The Fireball-specific tests cover renderer registration, projectile style payload, cast/trail/impact timing, absence of wind-up, per-hit ignite feedback, and graceful fallback when optional VFX primitives are unavailable.

### Design and foundation consistency

PASS. The change stays within the active card-combat/VFX architecture described in `game/docs/design.md`: Fireball remains a weapon card, server-authoritative hit/burn logic is unchanged, and the client only renders the `cardUsed` event. The core requirements in `game/docs/requirements.md` are preserved by the clean capture: 3D scene rendering, WebSocket connection, multiplayer presence, and movement/gameplay progression all worked.

### Debug scenarios

PASS. This ticket did not add or modify any `?debugScenario=` shortcut. The captured run used normal lobby create/join and ready-up flow, with `debugScenario: null`.

## Remaining gaps

None.

VERDICT: PASS
