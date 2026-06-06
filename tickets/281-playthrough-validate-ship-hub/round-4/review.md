# Senior Review

## Per-Criterion Findings

### Runtime health

PASS. The round-4 captured run loaded cleanly: `metrics.json` has `ok: true`, no `harness_failure`, and an empty `pageerrors` array. `console.log` contains only Vite/debug/init messages and no `pageerror` or `[fatal]` lines from game code.

### Shared ship hub validation

PASS. The full generated hub validation artifacts under `game/validation/hub/` are present and coherent: `run-summary.json` reports `preset: "hub"`, `steps: "full"`, and `ok: true`; `findings.md` reports PASS from the same run. The screenshots cover the requested hub overview, operations/commerce/salon rooms, paid booth, hat swap, telepipe before/after, and the lobby finder.

### Auth, hub entry, walkability, and party presence

PASS. The validation reuses the existing auth/browser entry flow, creates a lobby through the UI, joins a second player, verifies two players on the host, moves the remote player, and walks the host through all three hub rooms while the layout remains `profile: "hub"` with `roomCount: 3`. The screenshots visually show the ship hub rooms and the party list.

### Booth gold charge and free hat swap

PASS. The booth probes assert the paid appearance path deducts exactly 25 gold (`1000 -> 975`) and the hat-only swap costs nothing (`975 -> 975`). The harness uses the real character booth save/confirm flow with local/dev test hooks only to patch the booth selection deterministically.

### Telepipe UP resource reset

PASS. The telepipe validation depletes run resources first (`magicStones` down to about 15 and one card charge spent), casts Telepipe, suspends to the hub, abandons the suspended checkpoint, then redeploys. The post-deploy probe shows fresh-run resources (`magicStones` about 49, occupied cards at full charges), a different `runId`, and `checkpointRestoredInLog: false`, so this proves abandon + fresh deploy rather than resume.

### Lobby finder remains 2D

PASS. The auth/lobby-finder probe verifies the lobby browser is visible, the lobby hub is hidden, `hub3dStarted` is false, and the browser is not fixed over an active playing canvas. `09-lobby-finder.png` shows the 2D Lobby Registry menu rather than the 3D hub.

### Debug scenarios and test hooks

PASS. The new/used shortcuts are gated through the existing local/dev debug path (`?debugScenario` and `ALLOW_DEBUG_SCENARIOS` / localhost socket allowance). The end states remain reachable through normal play: currency and hats through dungeon rewards/shop unlocks, Telepipe through an in-run deck/card flow, and suspended-run reset through Telepipe extraction plus abandon. The harness does not bypass the server-side booth save, Telepipe suspend, abandon, or fresh deploy invariants.

### Design and requirements consistency

PASS. The implementation stays aligned with `game/docs/design.md`: the lobby remains a squad management hub, Telepipe suspends an in-progress run, and abandoning clears the checkpoint. It does not regress the foundation requirements: the captured run renders a Three.js scene, connects over WebSockets, shows multiplayer presence, and movement/state synchronization is exercised in the hub validation and tests.

### Code quality and validation

PASS. The diff was reviewed against `8bf01834a57011da31965759d85eea40e47222bb`; the current game code is the source of truth. Coverage output reports 31 test files and 1160 tests passing. I noticed one unused import nit in `game/server/simulation.js`, filed separately in `nits.md`; it is not a blocker.

## Remaining gaps

None.

VERDICT: PASS
