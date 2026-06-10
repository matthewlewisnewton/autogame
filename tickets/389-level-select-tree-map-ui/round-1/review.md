# Review: 389-level-select-tree-map-ui

## Runtime health

Pass. `metrics.json` reports `ok: true`, the client and game server started, `pageerrors` is empty, and `console.log` has no `pageerror` or `[fatal]` lines from game code. The only notable console entry is a non-fatal 409 resource response during the harness auth flow; it did not prevent the lobby or gameplay smoke from loading.

## Acceptance criteria

### Renders the unlock graph from 388

Pass. The client stores `levelUnlockGraph` from `questUpdate`/`lobbyUpdate` payloads and renders it through `renderLevelMap()`. The server contract from 388 emits one graph node per quest tier via `buildLevelUnlockGraph()`, including normalized prerequisite arrays and per-account `locked`/`unlocked`/`cleared` state.

### Draws a box per level/tier, including boss levels

Pass. `renderLevelMap()` creates one `.level-map-node` button per graph node. The server marks `stage_boss` tiers with `isBoss`, and the client applies boss styling via `.level-map-node-boss`, so level-1, level-2, and boss-tier nodes are represented from the graph data.

### Lays nodes out left-to-right by prerequisite depth

Pass. `computeLevelMapLayout()` assigns column 0 to leaves and uses `1 + max(prerequisite column)` for dependent nodes, matching the required left-to-right prerequisite-depth layout. Nodes sharing a column receive separate rows.

### Draws edges from prerequisites to dependent levels

Pass. `computeLevelMapEdges()` emits one edge per `unlockRequires` entry, and the SVG edge layer draws those edges behind the node boxes. Multi-prerequisite boss nodes therefore get multiple converging incoming edges.

### Styles locked, unlocked, and cleared states

Pass. The renderer maps the graph state into distinct `level-map-node-locked`, `level-map-node-unlocked`, and `level-map-node-cleared` classes, with CSS differentiating disabled locked nodes, unlocked nodes, cleared nodes, selected nodes, and boss nodes.

### Clicking an unlocked node selects that level/tier to play

Pass. Click handling ignores disabled/locked nodes and emits the existing `selectQuest` socket event with `{ questId, tier }` for selectable nodes. Selection remains server-authoritative: `lobbyHandlers.js` validates quest id, tier, unlock state, suspended-run state, and emits updated quest payload/layout preview before deploy.

### Quest-board placement and lobby behavior

Pass. The map fronts the existing Contract Terminal/quest board panel and does not replace or alter the lobby finder menu. The quest panel is still opened through the lobby quest booth flow, preserving the design's lobby-browser -> lobby -> quest selection -> dungeon loop.

## Design and requirements fit

Pass. The implementation stays in `game/client` plus client tests, is consistent with the documented lobby selection flow, and does not regress the foundational requirements: the captured run shows the Three.js scene, websocket connection, multiplayer lobby/gameplay state, and movement smoke still work.

## Code quality and tests

Pass. The implementation is reasonably scoped and covered by focused unit tests for layout, edges, state styling, click behavior, empty graphs, and integration tests through `main.js` quest updates. The coverage run reports 16 test files passed and 309 tests passed, including `client/test/levelMap.test.js` and `client/test/levelMapIntegration.test.js`.

## Debug scenarios

No new `?debugScenario=...` shortcut was added by this ticket. The existing debug hooks remain gated by localhost-only URL parameters and are not part of normal gameplay.

## Remaining gaps

None.
VERDICT: PASS
