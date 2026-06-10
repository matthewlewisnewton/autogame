## Runtime health

PASS for startup/load health. `metrics.json` reports `"ok": true`, no server-start failure, and an empty `pageerrors` array. `console.log` has no `pageerror` or `[fatal]` lines from game code; the only notable noise is non-fatal setup/resource output and benign Vite socket-close logging in the capture logs.

Coverage/validation visibility: `coverage.log` reports 167 test files passed, 2644 tests passed, with coverage thresholds disabled.

## Acceptance criteria findings

### Evolved Archive Wyrm is the only flying Wyrm minion

Met. `ancient_wyrm` has a positive `altitude` in `game/shared/cardStats.json`, while `dungeon_drake` remains untouched. The creature summon path in `game/server/cardEffects.js` applies `flying: true` and the card-defined altitude only when `cardDef.effect === 'ancient_wyrm'`, after normal Wyrm breath stats are applied. Server tests cover the socket-spawned minion fields, `updateMinions()` hover behavior, snapshot fields, and a grounded `dungeon_drake` regression.

### Airborne movement/state uses the existing altitude model

Met. `game/server/simulation.js` resolves minion Y before and after minion AI using `resolveEntityY`, so a flying Archive Wyrm hovers at sampled floor height plus altitude and remains floor-aware across slopes/raised floors. This is consistent with the airborne support already used by other fliers.

### Archive Wyrm attacks from the air with height-aware breath

Met for normal gameplay and server mechanics. `lockMinionBreathDirection()` and `applyWyrmBreathTick()` use `getEntityWorldY(minion)` and `getEntityWorldY(target)`, feed `originY` and `dirY` into the 3D cone hit path, and queue pending breath payloads with `origin.y` for airborne Wyrms. Grounded Vault Wyrm behavior remains legacy-compatible: grounded breath events do not need to include `origin.y`, and the existing burn/breath tests remain green.

### Client renders the airborne minion and airborne breath VFX

Met. `game/client/renderer/minionSync.js` uses the generic `flyingRenderOffset()` and shadow path for all flying minions, including `ancient_wyrm`, while grounded minions stay unchanged. `game/client/cardRenderers.js` preserves optional `origin.y` and `direction.y`, passes airborne origins into the breath cone/telegraph/burst, and adjusts the along-cone burst Y from the tilted direction. Client tests cover the elevated Archive Wyrm breath payload and floor-aware airborne render offsets.

### Design and foundation consistency

Met. The change is consistent with the 3D action-RPG/card-combat design and does not regress the foundation requirements: the captured run shows a rendered scene, live server/client connection, multiplayer visualization, and movement/state updates. The implementation uses existing card evolution, minion, airborne, and height-aware targeting patterns rather than introducing a parallel path.

### Debug scenarios

Blocking gap. The existing debug entry point is properly gated behind localhost/`ALLOW_DEBUG_SCENARIOS` and the URL-triggered `?debugScenario=...` client path, but the newly exposed `archive-wyrm-elevated-breath` scenario creates an end-state that is not equivalent to normal gameplay. It spawns a normal `grunt`, manually sets `elevated.y = floorY + 5`, and leaves it non-flying. The simulation's enemy update loop floor-snaps grounded enemies via `resolveEntityY()` each tick, so a grounded grunt at the same `(x, z)` but five units above the floor is not a stable or normally reachable gameplay state. A debug shortcut that bypasses that invariant is a blocking QA gap under this ticket's rules.

## Remaining gaps

1. `archive-wyrm-elevated-breath` bypasses normal enemy height invariants by manually raising a grounded grunt; use a normal reachable elevated target state instead, such as a flying/elevated enemy with proper `flying`/`altitude` fields or a legitimate vertical-layout position whose sampled floor produces the target height.

VERDICT: FAIL
