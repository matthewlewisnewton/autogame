# Senior Review — stage_boss objective counter increments on regular enemy kills

## Runtime health (gating check)
- `metrics.json`: `"ok": true`, `pageerrors: []`, servers started (URL bound on :5176).
- `console.log`: only benign noise — two `409 (Conflict)` resource-load lines from
  the lobby create/join flow; no `pageerror`, no `[fatal]`, no uncaught exceptions
  from game code. No `harness_failure` block.
- The capture is a deterministic full-flow smoke (auth → lobby → ready → movement →
  dodge); it loaded and ran cleanly. **Game runs.**

## Acceptance Criterion
> For stage_boss objectives, defeatedEnemies/totalEnemies only reflects the boss
> entity (or a separate boss progress field is used); killing non-boss enemies does
> not move the stage-boss objective counter; covered by a server test.

**Met.** The fix scopes `stage_boss` defeatedEnemies to encounter-only hostiles:

- `game/server/encounters.js` adds `countStageBossObjectiveKills(dyingEnemies, run)`
  which counts only (a) the encounter boss while `encounter.phase === ACTIVE`, and
  (b) enemies tagged `encounterHostile`; it explicitly skips `scriptedWave` enemies
  and any non-encounter spawns.
- `game/server/objectives.js:310` tags encounter adds spawned by the stage_boss
  `spawnQuestEntities` with `encounterHostile = true`, so legitimate encounter adds
  still count toward `totalEnemies = addCount + 1`.
- `game/server/progression.js`:
  - `recordEnemyDefeated` now early-returns for `stage_boss` (so scripted-wave /
    bulk kills no longer leak into the counter).
  - `removeDeadEnemies` computes `countStageBossObjectiveKills(dying, run)` and only
    advances the objective by that scoped count for stage_boss runs; other objective
    types keep the prior `recordEnemyDefeated(removed)` path.
  - `tryActivateEncounter` routes pre-activation dead-add counting through the same
    helper instead of blanket `recordEnemyDefeated`.

The interpretation is correct: "non-boss enemies" in the ticket means the scripted
dock grunts / Glacial Throwers that are *not* part of the boss encounter. Encounter
adds remain countable, which is consistent with `totalEnemies = addCount + 1`. For
Frost Crossing tier 1 (`addCount: 0`), only the boss kill can move the counter — the
exact regression the ticket describes.

**Covered by a server test.** `game/server/test/frost_crossing_stage_boss.test.js`
reproduces the ticket repro on the real Frost Crossing tier-1 layout: killing a
scripted dock grunt (`room:0`) and a scripted Glacial Thrower (`band:ice`) each leave
`{defeatedEnemies:0, totalEnemies:1, bossDefeated:false}` with phase `dormant` and run
`playing`. `stage_boss_kill_count.test.js` adds a scripted-wave-on-stage_boss case.
The six tier-2 stage_boss suites updated their `recordEnemyDefeated` assertions to
verify the counter is no longer inflated — matching the corrected behavior.

## Consistency / regressions
- Design (`game/docs/design.md`) and foundation requirements are not regressed; the
  boss-defeat completion path (`onBossDefeated` / `isEncounterCleared` → victory) is
  intact and exercised by the existing "completes the run with victory" test.
- Boss is not double-counted: when it dies while active it contributes a single +1
  via `countStageBossObjectiveKills` and `onStageBossDefeated` sets `bossDefeated`.
- No debug scenario (`?debugScenario=`) was added or changed by this ticket.
- Full suite green: **server 2651/2651, client 1353/1353** at HEAD.

## Code quality
Clean, well-scoped helper with a single source of truth for stage_boss kill counting,
reused across `removeDeadEnemies` and `tryActivateEncounter`. No dead code, no console
errors.

## Remaining gaps
None blocking.

VERDICT: PASS
