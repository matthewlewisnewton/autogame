# 07 — Rooms boss visual assertion without debug-only grunt spawn

Round-2 review found that `bossDistinctFromAdds` depends on `spawnHarnessBossVisualAddIfNeeded` (and a matching grunt spawn inside `training-caverns-encounter-trigger`), which fabricates an active boss-plus-add state that normal Training Caverns activation cannot reach because `tryActivateEncounter()` clears non-boss enemies. Rework the rooms boss visual probe so it compares the Annex Overseer against a **normally reachable** add state—e.g. capture during mid-combat while the dormant boss and live adds coexist—then remove the post-activation debug grunt machinery.

## Acceptance Criteria

- `spawnHarnessBossVisualAddIfNeeded` is removed from `game/server/debugScenarios.js` exports and its `registerEncounterActivationHook` call is removed from `game/server/index.js`.
- `training-caverns-encounter-trigger` no longer spawns a debug grunt after activation; it only performs the same encounter activation/lock transition reachable by walking into the trigger in normal play.
- `runBossEncounterStep` (rooms / `annex_overseer` path) captures `bossVisualIdentity` from a **reachable** gameplay moment where both the stage boss and at least one live non-boss add are present (recommended: the existing `onMidCombat` hook after `training-caverns-near-adds`, while encounter phase is still `dormant`). The probe must **not** require a post-activation spawned grunt.
- `buildAssertions` / `bossDistinctFromAdds` still pass for the rooms preset using the relocated probe data (`bossType === 'annex_overseer'`, `bossDistinctFromAdds === true`, `bossRenderScale > addRenderScale` when scales are available).
- `cd game && pnpm test:quick` exits `0` (including `server/test/debug-scenarios.test.js` and any harness findings tests).
- `cd game && pnpm validate:rooms` exits `0`; `game/validation/rooms/run-summary.json` has `"ok": true` with `assertions.bossDistinctFromAdds === true` and `bossEncounter.probes.bossVisualIdentity.bossDistinctFromAdds === true`.
- `game/validation/rooms/findings.md` and `game/validation/rooms/harness-blocker-fixes.md` no longer claim that a debug-only post-activation grunt spawn is a normal gameplay equivalent.

## Technical Specs

- **Remove debug grunt hook:** `game/server/debugScenarios.js` — delete `spawnHarnessBossVisualAddIfNeeded` and its module export; remove the inline `spawnEnemy` grunt block (~lines 1049–1052) from `training-caverns-encounter-trigger`.
- **Unregister hook:** `game/server/index.js` — remove `registerEncounterActivationHook(debugScenarios.spawnHarnessBossVisualAddIfNeeded)`.
- **Retarget probe timing:** `harness/validate/playthrough.mjs` — in `runBossEncounterStep`, call `captureBossVisualIdentityProbe(page, bossType)` during the mid-combat capture path (inside or immediately after `onMidCombat`, before adds are fully defeated) for presets where post-activation adds are cleared (`rooms` / `annex_overseer`; keep sunken-canyon behavior unchanged unless it shares the same unreachable-state bug). Store the result on `bossEncounter.probes.bossVisualIdentity` and top-level artifact fields as today.
- **Assertions / artifacts:** `harness/validate/playthrough.mjs` (`buildAssertions`, `writeFullArtifacts`), `harness/validate/lib/findings.mjs`, `harness/validate/verify-rooms-artifacts.mjs` — confirm they read the relocated probe without requiring an active-encounter grunt.
- **Tests:** update `game/server/test/debug-scenarios.test.js` if any case asserted on the removed hook; add or adjust a harness/unit test proving `bossDistinctFromAdds` is sourced from the mid-combat probe path when no activation hook runs.
- **Docs:** refresh `game/validation/rooms/findings.md` and `game/validation/rooms/harness-blocker-fixes.md` after `pnpm validate:rooms`.
- **Scope:** `game/server/**`, `harness/validate/**`, `game/validation/rooms/**` only.

## Verification: code
