# Final review - 373-playthrough-validate-fire-level

## Runtime health

PASS. The captured `round-5/metrics.json` has `"ok": true`, no `harness_failure`, and an empty `pageerrors` array. `round-5/pageerrors.json` is empty. `round-5/console.log` contains only Vite connection logs, one non-fatal 409 resource response, scene initialization, and debug-scenario/launch logs; there are no `pageerror` or `[fatal]` lines from game code.

The committed fire playthrough artifacts also show a clean validation run: `game/validation/fire/findings.md` reports PASS, `game/validation/fire/console.log` has no page errors, and the sampled screenshots show the fire run, burn tick damage, victory overlay, and telepipe fresh-deploy state.

## Acceptance criteria

### Fire-level preset and validation driver

PASS. The `fire` preset is wired into the playthrough driver and package scripts, targets `ember_descent` tier 1, writes to `game/validation/fire/`, and verifies the generated artifact set. `game/validation/fire/run-summary.json` records `preset: "fire"`, `steps: "full"`, `questId: "ember_descent"`, `layoutProfile: "fire-cavern"`, and all required assertions true.

### Fire level deployment and enemy burn behavior

PASS. `ember_descent` tier 1 is a real quest definition with the `fire-cavern` layout and an enemy pool including `ember_wraith`, so the fire-level state is reachable through normal quest selection/deployment. The validation run deploys into `fire-cavern`, confirms live enemies, and records floor alignment for entry and mid-combat. The Ember Wraith burn probe turns godmode off, applies burn to the player, and observes HP dropping from 100 to 87 across burn ticks.

### Stage boss handling

PASS. `ember_descent` tier 1 has no stage-boss encounter in the live quest definition. The ticket explicitly allowed this as long as the gap was noted, and `game/validation/fire/findings.md` documents that boss health-bar/encounter UI and distinct boss visuals are N/A for this fire-level tier. Victory is driven by the `defeat_enemies` objective.

### Card mechanics: burn, slow, cleanse, wind-up

PASS. The validation probes exercise real server card resolution rather than visual-only stubs: Fireball applies burn, Permafrost Lance applies slow and clears burn, Purifying Pulse clears the seeded burn and heals, and Corebreaker Greatsword enters wind-up with input lock and telegraph. The supporting unit/integration coverage includes mutual exclusion, Purifying Pulse cleanse, debug scenario setup, burn tick damage, and Ember Wraith burn behavior.

### Telepipe vitals persistence and fresh-sortie charge reset

PASS. The fire telepipe step depletes run resources, places Telepipe, suspends to hub, abandons/restores into a fresh sortie, and confirms HP/MS persistence plus full card-charge reset. `run-summary.json` shows HP 60 and MS 20 before and after, a new run id after deploy, and full post-deploy hand charges.

### Debug-scenario requirements

PASS. The new fire scenarios are gated by the server-side `ALLOW_DEBUG_SCENARIOS` check before `debugScenario` or debug godmode can mutate state. They are QA shortcuts over real quest/card/combat systems: `fire-cavern` uses the same quest/layout/run machinery as normal deployment, follow-on scenarios require an active `ember_descent` defeat-enemies run, and the card probes still use normal `useCard` resolution, damage/status application, and telepipe/run state. The equivalent end states are reachable through normal play by selecting Ember Descent, encountering Ember Wraiths, earning/using the relevant cards, and using Telepipe.

### Design and foundation consistency

PASS. The implementation stays within the documented lobby -> dungeon -> card-combat loop, preserves server-authoritative combat and state transitions, and does not regress the foundational requirements: the captured run connects over WebSockets, initializes the scene/canvas, renders the player and dungeon state, and keeps movement/combat state synchronized through server snapshots.

### Code quality and validation

PASS. The live code paths are covered by focused tests plus the full validation artifacts. `round-5/coverage.log` shows `137` test files and `2080` tests passed with coverage reporting enabled. `git diff --check` reported no whitespace errors. I did not find dead or broken ticket code that affects the acceptance criteria.

## Remaining gaps

None.

VERDICT: PASS
