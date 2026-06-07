## Runtime health

PASS. The captured game run loaded successfully: `metrics.json` has `"ok": true`, no `harness_failure`, and an empty `pageerrors` array. `console.log` contains no `pageerror` or `[fatal]` entries from game code. The two 409 resource lines occurred during auth/setup and did not prevent the game from loading, rendering, or reaching gameplay.

## Acceptance criteria

### Entering the hub shows walkable 3D space with the menu not covering it

PASS. The live code now separates `#lobby-hud` from the large dismissible `#lobby` menu and calls `dismissGameLobby()` on hub lobby entry. The capture probes show `sceneInitialized: true`, `hasCanvas: true`, `lobbyVisible: false`, `lobbyMenuDismissed: true`, and `players: 2` after the squad enters play. This is consistent with the ticket goal: the large Lobby Connection overlay is no longer the default thing covering the walkable scene.

### Lobby menu opens only on demand and stays dismissed while walking

PASS. `showGameLobby()` is now the explicit reopen path, while `dismissGameLobby()` records `lobbyMenuDismissed` and hides the quest wrapper with the menu. The state-update and hub-presence paths preserve the dismissed state instead of re-showing the menu. Booth interactions for quest, deck, and shop call the explicit open path, so the menu still appears when the player asks for a station UI.

### Party-mate avatars remain visible in 3D

PASS. The implementation did not remove the hub-presence merge/render path, and the capture probes show a remote squadmate entry with world coordinates while the menu is dismissed. The new client test also exercises hub presence updates while dismissed and verifies the remote squadmate remains present in harness state.

### Client test for dismiss / stays-dismissed behavior

PASS. `client/test/lobby-menu-dismiss.test.js` covers hub lobby join starting hidden, state updates staying hidden after dismissal, hub presence updates not reopening the menu, and deck/shop booth reopen behavior. `coverage.log` shows the test run passed: 12 files and 247 tests passed. Coverage thresholds were disabled as expected.

## Design and requirements consistency

PASS. The change supports the design doc's lobby role of squad management in a shared 3D space without regressing the foundational requirements: the captured run rendered a Three.js scene, connected to the server, represented two multiplayer participants, and progressed through movement/gameplay probes.

## Code quality

PASS. The main implementation is scoped to the client lobby/menu surface and keeps state explicit with `lobbyMenuDismissed` and `extractedLobbyOverlayActive`. The persistent lobby controls moved outside the dismissible menu, which avoids losing essential lobby actions when the large panel is hidden. I did not find dead code, a normal-gameplay regression, or a blocking console/runtime issue.

## Debug scenarios

No `?debugScenario=NAME` shortcut was added or changed for this ticket. Existing debug-scenario gating remains localhost-only through `debugScenarioAllowed`, and normal gameplay reaches the same lobby and booth states without debug shortcuts.

## Remaining gaps

None.

VERDICT: PASS
