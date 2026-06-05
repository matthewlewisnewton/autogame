# Senior Review — 230-hub-client-render

## Runtime health (blocking gate)

`round-2/metrics.json`: `"ok": true`, `"pageerrors": []`, no `harness_failure`.
`round-2/console.log` shows only the normal init lines (`[initScene] Initializing
Three.js scene...`) plus the pre-existing `sunken-canyon-stage` debug-scenario
application — no `pageerror` / `[fatal]` / uncaught entries. The captured run
started, loaded, and ran cleanly. Gate passes.

Note on capture: the plan source is `fallback` (deterministic full-flow world-stage
smoke), so the scripted scenario is the sunken-canyon stage swap rather than a
hub-specific path. That does not undermine this ticket — `01-initial.png` clearly
shows the lobby phase with the rendered hub geometry (angular ship-interior walls/
floor) visible *behind* the now-translucent lobby overlay, which is exactly the
behavior this ticket delivers. The hub-specific behavior is additionally covered by
unit tests and the dedicated `test-hub-lobby-visible.mjs` smoke script.

## Acceptance criteria

### AC1 — Client renders the 'hub' layout (reuse renderer)
Met. The server builds a deterministic `HUB_LAYOUT = generateHub(0)` once at module
load and attaches it to the `lobbyJoined` payload (`game/server/index.js`). The
client caches it as `hubLayout` and renders it through the existing world-stage
renderer: `renderHubScene()` (`game/client/main.js`) calls `rendererInitScene(hubLayout, …)`
on first entry and `rebuildDungeonLayout(hubLayout)` thereafter — the same renderer
entry points used for quest stages. `renderedSceneProfile` ('hub' | 'quest') tracks
which geometry is mounted so the lobby never reuses quest geometry and a deploy never
runs in hub geometry. `hub_client_payload.test.js` asserts the delivered `HUB_LAYOUT`
has `profile:'hub'`, named zones, passages, and booth anchors.

### AC2 — Local player avatar spawns + is visible in the hub during gamePhase==='lobby'
Met. `renderHubScene()` seats the avatar at the hub `role:'start'` spawn via
`setPlayerPosition(getSpawnPosition()…)`, sets `gameState.layout = hubLayout`, and
refreshes the renderer's game-state ref so the animate loop builds the local avatar
from `gameState.players[myId]`. The `stateUpdate` handler now selects the hub layout
for floor sampling while `gamePhase==='lobby'`, so the avatar sits on the hub floor.
`hub-lobby-render.test.js` drives this contract and asserts the avatar mesh
(`getMeshMaps().playersMeshes.p1`) exists after a lobby-phase frame.

### AC3 — No console errors; walkable
Met. Captured run shows zero page/console errors. The hub carries real collision
geometry: `computeWalkableAABBs(generateHub(0)).length > 0` is asserted on both client
and server sides, and `getWallColliders().length > 0` after the hub scene builds — so
the floor/walls are walkable, consistent with other stages.

## Integration / regression checks
- Lobby↔run transitions refactored cleanly: lobby-join → hub, run-join/deploy → quest,
  and `returnToGuildLobby({ rebuildHub })` rebuilds the hub once per return (guarded so
  it does not fire on every lobby-phase `stateUpdate`). `applyQuestLayoutFromServer` now
  only caches the selected quest layout during the lobby instead of moving the avatar
  off the hub floor. All geometry-switch paths set `renderedSceneProfile`.
- `style.css`: the `#lobby` overlay background dropped its opaque `#0f172a` base so the
  hub canvas shows through; only sub-1-alpha decorative layers remain, and the title got
  a text-shadow for legibility. Confirmed visually in `01-initial.png`.
- Debug scenarios: this ticket adds none. The `sunken-canyon-stage` scenario in the
  capture is pre-existing and untouched by this diff. The URL parameter remains the only
  entry point and the normal flow is unaffected.
- Tests: full suite = 1859 passed. The single failure (`field_medic_kit.test.js`,
  magic-stones regen `10.005` vs `10`) is a pre-existing floating-point/timing flake —
  this ticket touches no server simulation/regen code, and the test passes on rerun.

## Remaining gaps
None blocking. One non-blocking nit (test-stderr noise from the renderer's
`/models/player.glb` URL parse under jsdom) is recorded in `nits.md`.

VERDICT: PASS
