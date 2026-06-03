## Per-Criterion Findings

### Runtime health and capture proof

FAIL. The captured run is not valid proof that the game starts and loads cleanly. `metrics.json` reports `"ok": false` with `failure_kind: "capture_failed"`, and the expected browser `console.log` is missing. The dev server and game server logs show both servers reached ready/listening states, but `screenshot.log` failed before browser capture with:

```text
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'playwright' imported from .../harness/screenshot.mjs
```

There is no `pageerrors` array to inspect because the browser capture did not complete. Per the ticket gate, this is an automatic fail: a clean captured run is required before this top-level ticket can pass.

### Registry maps the seven requested entity keys to `/models/` files

PASS. `game/client/models.js` maps `grunt`, `skirmisher`, `miniboss`, `spawner`, `ancient_wyrm`, `null_crawler`, and `bulkhead_mauler` to the expected `/models/*.glb` paths. The corresponding tracked assets exist under `game/client/public/models/`.

### Loaded models are scaled to primitive size and grounded at entity y

FAIL. The scaling helper computes target heights from the existing primitive definitions, and `normalizeLoadedRegistryModel()` scales a loaded model and moves its local bounding-box minimum to `y=0`. However, the model is added as a child of the procedural host mesh after that host is positioned above the floor. Enemies are positioned at `enemyMeshHalfHeight(type)`, and minions are always positioned at `y=0.5`. Because the normalized model's local feet are at `0`, the loaded model's world-space feet end up at the host's raised y position, so enemies/minions float above the entity floor instead of sitting at entity y.

This violates the explicit grounding criterion and would be visible once capture runs successfully.

### Player remains procedural

PASS. `MODEL_REGISTRY.player` remains `null`, and the regression tests assert `createPlayerAvatar()` does not attach a model override.

### Missing or failed model falls back to procedural mesh

PASS. `loadModel()` resolves `null` on loader errors and caches failures, while `attachRegistryModel()` leaves the procedural mesh visible when the load result is null or rejected. The added tests cover missing-path fallback and player procedural behavior.

### Existing tests and visual capture

PARTIAL. The coverage log shows the Vitest suite passed: 7 files, 175 tests. Visual capture did not complete because Playwright could not be resolved by the screenshot harness, so the ticket lacks the required screenshot proof showing the new meshes.

### Design and requirements consistency

PARTIAL. The registry and fallback behavior are consistent with the client rendering architecture and do not intentionally change server-client gameplay, movement, or multiplayer requirements. The grounding bug is a rendering integration defect, not a gameplay-system regression.

### Debug scenarios

PASS. This ticket did not add or change any `?debugScenario=NAME` shortcut or server debug scenario path.

## Remaining gaps

1. The captured run failed before producing browser proof (`metrics.json` has `"ok": false`; browser `console.log` is missing) because the screenshot harness could not import Playwright.
2. Registry-loaded enemy and minion models are normalized locally but attached to hosts positioned above the floor, so their feet float above entity y instead of being grounded.

VERDICT: FAIL
