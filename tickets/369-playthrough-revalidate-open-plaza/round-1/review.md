# Senior Review: 369-playthrough-revalidate-open-plaza

## Runtime Health

The required round-1 capture starts and loads cleanly: `metrics.json` has `"ok": true`, `pageerrors` is empty, and `pageerrors.json` is empty. The round-1 `console.log` has no `pageerror` or `[fatal]` entries from game code. This satisfies the automatic runtime-health gate.

The round-1 capture plan is a fallback telepipe suspend/resume scenario rather than the open-plaza playthrough itself, so I also reviewed the ticket's committed `game/validation/open-plaza/` artifacts as the implementation's proof for the open-plaza acceptance criteria.

## Acceptance Criteria Findings

### Revalidate OPEN-PLAZA / Arena Trials

Partially satisfied. `game/validation/open-plaza/run-summary.json` records a full `open-plaza` run with `ok: true`, `steps: "full"`, and all 11 assertions passing: boss spawn, encounter activation, boss defeat, victory, boss encounter HUD, boss visual identity, slow/burn exclusivity, heal/cleanse, wind-up telegraph, telepipe vitals preservation, and card-charge reset on new sortie. The screenshots listed in the summary cover lobby, hub, entry, mid-combat, dormant/active boss, boss defeat, victory, and the new-content exercises.

However, the changed test/coverage run is not green. `round-1/coverage.log` reports `1 failed | 1719 passed`, with the failing test in `server/test/debug-scenarios.test.js` for `arena-trials-boss-approach`. This is in the changed debug-scenario surface used by the validation driver, so it is a blocking quality gap even though the Playwright validation artifact is green.

### Boss Health Bar / Encounter UI

Satisfied by the open-plaza run artifacts. The active encounter probe shows the stage-boss HUD visible, the encounter locked and active, and a non-empty boss name (`Trial Warden`) with a full health fill.

### Distinct Boss Visuals

Functionally satisfied by the probe and screenshot: the active boss is `arena_champion`, distinct from the nearby grunt, with boss render scale `3` versus add scale about `1.025`.

There is still a blocking reporting gap: `game/validation/open-plaza/console.log` contains `[models] failed to load model "/models/arena-champion.glb"` plus repeated `502 (Bad Gateway)` resource errors, while `findings.md` says "None observed" under console/page errors and "No visual glitches recorded." The current live `game/client/models.js` maps `arena_champion` to procedural-only (`null`), so this may be stale validation noise, but the ticket explicitly requires every bug/glitch/oddity to be listed in `findings.md`; the committed artifact does not do that.

### Slow / Burn Mutual Exclusivity

Satisfied by the artifact probes. The slow/burn exercise applied slow with burn inactive, then applied burn with slow inactive, and `slowBurnMutuallyExclusive` is true.

### Heal / Cleanse Card

Satisfied by the Purifying Pulse probe. HP increased from 40 to 60 and the burn status was cleared, with `healCleanseApplied` true.

### Wind-Up Card Input Lock / Telegraph

Satisfied by the wind-up probe. `magma_greatsword` entered `cardUseState: "windup"`, input lock was active, and a telegraph/activating slot was visible.

### Telepipe Vitals Persistence And New-Sortie Charges

Satisfied by the validation artifact. The open-plaza telepipe step shows HP and magic stones preserved across suspend/abandon/new deploy, with a new run id and fresh full-charge hand cards.

### Debug Scenario Review

Partially satisfied. The new `arena-trials-*` debug scenarios are only reachable through the debug scenario socket path, which is gated by `ALLOW_DEBUG_SCENARIOS`, production checks, or local development access. The code comments tie the shortcuts back to normal gameplay reachability: unlocking Arena Trials Tier 2, traversing to adds, clearing adds, walking into the boss trigger, and purchasing/holding Telepipe.

The scenario invariants are not robust enough yet because the changed debug-scenario test for `arena-trials-boss-approach` fails after non-boss enemies are cleared. That failure blocks the ticket until the scenario and its tests agree on the expected dormant boss-approach state.

## Design And Requirements Consistency

The implemented validation path is consistent with the documented core loop and stage-boss flow: lobby setup, dungeon deployment, arena boss encounter, card combat, Telepipe evacuation/new-sortie behavior, and victory are all exercised. The runtime capture confirms the foundation requirements still load a rendered Three.js scene with server/client connectivity.

## Remaining gaps

1. The changed coverage/test run is failing in `server/test/debug-scenarios.test.js` for `arena-trials-boss-approach`, so the debug-scenario surface used by the open-plaza driver is not robustly validated.
2. `game/validation/open-plaza/findings.md` does not report the console/resource oddities present in `game/validation/open-plaza/console.log`, including the failed `arena-champion.glb` model load warning and repeated `502` resource errors.

VERDICT: FAIL
