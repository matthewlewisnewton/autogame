# Senior Review: 363-anim-thermal-column

## Runtime health

PASS. The captured run in `metrics.json` reports `"ok": true`, reached connected gameplay with initialized scene/canvas and active player/enemy state, and has an empty `pageerrors` array. `pageerrors.json` is empty. `console.log` contains only Vite connection lines, expected 409 registration/login conflicts from the harness flow, and scene initialization logs; there are no `pageerror` or `[fatal]` entries from game code.

The client and server logs show the Vite/game servers started successfully. The Vite log contains only the benign Three.js `Clock` deprecation warning. The round folder did not contain the PNG files named by `metrics.json`, so the final review could not inspect saved screenshots directly; the metrics/probes and logs still prove the game started and loaded cleanly.

## Acceptance criteria

### Thermal Column visual matches its name/theme

PASS. The old flat inferno ring has been replaced by a dedicated Thermal Column composition: a full-radius scorch footprint, a vertical rising fire shaft, immediate eruption ring/burst/decal, per-hit ignite sparks, and hot red/orange emissive styling from the card accent. This reads as a column of heat/fire rather than a generic spell ring and uses the existing shared renderer primitive path instead of adding an unrelated VFX system.

### Timing is synced to server-side effect resolution

PASS. The server's normal `cardUse` path resolves `inferno_pillar` as an instant radial hit, spawns the lingering area effect, and emits `CARD_USED`. The client renderer mirrors that with immediate eruption feedback at cast time, a lingering column duration of `dotTicks * dotIntervalMs + 250`, and four deferred DoT pulse rings at 500 ms intervals. Current shared stats for Thermal Column are four ticks at 500 ms, matching the server area-effect schedule. The card has no positive `windUpMs`, so there is no 307 wind-up telegraph requirement for this card.

### Scope and integration

PASS. The implementation is scoped to `game/client/cardRenderers.js`, `game/client/renderer.js`, and client tests. The card remains registered as exactly one renderer for `inferno_pillar`, and `main.js` already wires `spawnInfernoPillarEffect` plus `scheduleAfter` into the normal `CARD_USED` event path. Normal gameplay reachability is preserved through the existing Dragons Breath evolution into Thermal Column and normal server-side card-use validation.

### Performance and cleanup

PASS. The new effect adds two active effect meshes plus scheduled primitive pulses, all handled through the existing `activeEffects` lifecycle. The thermal shaft has a dedicated update branch with no per-frame mesh allocation, and tests verify both the scorch ring and shaft are disposed when expired.

### Tests and coverage

PASS. The round's `coverage.log` shows the full client suite passed: 32 files, 527 tests. New coverage exercises renderer registration, removal of the generic summon fallback, cast-time eruption feedback, DoT pulse scheduling, per-hit ignite bursts, absence of wind-up for this instant spell, and primitive lifecycle/disposal. Coverage output contains expected modeled-asset fallback noise from unrelated renderer tests, not failures.

### Design and requirements consistency

PASS. The change is visual-only on the client and does not alter the card combat model, server-client architecture, multiplayer state, movement synchronization, or core dungeon loop described in the design and requirements documents.

### Debug scenarios

PASS. This ticket did not add or change a `?debugScenario=` shortcut. The existing `fire-spells-ready` scenario remains a QA shortcut only; normal reachability remains through reward/evolution progression and the same server card-use path.

## Remaining gaps

None.

VERDICT: PASS
