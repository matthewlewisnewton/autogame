# Senior Review - 280 Playthrough Validate Spire Ascent

## Per-Criterion Findings

### Runtime Health Capture

FAIL. The required round-1 capture did not load cleanly. `metrics.json` reports `"ok": false` with `failure_kind: "capture_failed"`, and `screenshot.log` also reports `"ok": false` after a `page.waitForFunction` timeout. `pageerrors.json` is empty and there are no `[pageerror]` or `[fatal]` lines from game code, so this is not a browser module/runtime exception. The captured client flow did hit repeated browser 502 resource failures while Vite logged `connect ECONNREFUSED 127.0.0.1:3004`; the server log only shows startup and two player connections before the port is later reported empty.

This alone blocks the ticket under the harness rules: the current captured run is the proof, and it is not green.

### Top-Level Spire Ascent Validation Goal

The implemented validation path is otherwise aimed at the requested level and boss. `game/validation/spire-ascent/run-summary.json` records `preset: "spire-ascent"`, `questId: "spire_ascent"`, `questTier: 2`, `bossType: "spire_warden"`, and all required assertions true: `bossSpawned`, `encounterActivated`, `bossDefeated`, and `victoryFired`. The artifact set includes hub, level entry, mid-combat, dormant boss, active boss, defeated boss, and victory screenshots, plus probes showing dormant/active encounter phases and final victory/objective completion.

The generated `findings.md` is internally stale: it still titles itself "Rooms validation findings" and labels boss spawn as `annex_overseer`. That does not invalidate the structured run proof, but it is worth cleaning up as a nit.

### Harness Entry Points And Artifact Checks

`game/package.json` adds `validate:spire-ascent` and `validate:spire-ascent:check`. The new preset threads `spire_ascent` Tier 2, `spire_warden`, the three Spire-specific debug scenarios, and Spire's broader add types through the existing playthrough driver. `harness/validate/lib/combat.mjs` preserves the Training Caverns default add set when a preset does not provide `addTypes`.

I ran `pnpm validate:spire-ascent:check`; it exited 0. The round-1 coverage log also shows `69 passed` test files and `1174 passed` tests.

### Debug Scenario Review

The new scenarios are debug-gated. The client auto-request path is the localhost-only `?debugScenario=...` flow, the Playwright helper uses the existing test hook, and the server rejects debug scenario and godmode socket events unless `isDebugScenarioAllowed()` passes. These shortcuts require an existing `spire_ascent` Tier 2 playing run, operate through server-owned state, and leave the normal deploy/run/encounter/victory machinery in place for the validation driver.

The equivalent normal end-state is reachable without the shortcut: `spire_ascent` Tier 2 is defined as a `stage_boss` quest with `spire_warden` at the `spire_summit`, tests cover Tier 1 unlocking Tier 2, Tier 2 stage-boss spawn/activation, and active boss defeat leading to victory. The shortcuts speed up positioning and HP for QA rather than replacing the actual server-side encounter or objective completion invariants.

### Design And Requirements Consistency

The implementation stays consistent with the lobby-to-dungeon core loop in `game/docs/design.md`: it validates a squad/lobby deploy into a generated dungeon, clears adds, activates the stage boss, defeats the boss, and observes the run-complete/victory overlay. It does not introduce a regression against the foundation requirements for 3D rendering, server/client socket play, player representation, or server-authoritative movement; however, the round-1 capture failure means that foundation is not proven by this review run.

## Remaining gaps

1. The required round-1 capture failed to load cleanly: `metrics.json` has `"ok": false`, the console shows repeated 502 resource errors, Vite logs `connect ECONNREFUSED 127.0.0.1:3004`, and the capture times out. This must be fixed or rerun successfully before the ticket can pass.

VERDICT: FAIL
