# Senior Review — progression: 'LV 1' badge is hardcoded

## Runtime health (pre-check)

- `metrics.json`: `"ok": true`, `capturePlanValid: true`, no `harness_failure` block.
- `pageerrors`: empty (`pageerrors.json` is `[]`). No `failure_kind`.
- `console.log`: scene initializes, both players ready up via booth and reach
  the `playing` phase. The only `error` lines are two `409 (Conflict)` resource
  loads (pre-existing account/login conflict on re-auth), which are benign,
  not uncaught page errors, and not emitted by the ticket's code.
- No `pageerror`/`[fatal]` lines from game code.

The game starts and loads cleanly. Proceeding to judge the criteria.

## Acceptance Criteria

The ticket's AC offers two paths; the implementer took the first (implement a
real XP/level system). Each clause:

**"player level is a real server-tracked stat"** — PASS.
`game/server/progression.js` adds `xp`/`level` to `createPlayerProgress()`,
`extractPersistentData()`, and the player record built in
`game/server/index.js:buildPlayerRecord`. Level is always derived from XP via
`levelForXp()` (curve `100 * (n-1) * n / 2`), and on restore the level is
recomputed from saved XP so the two cannot disagree (verified by the
"recomputes level from saved xp" test). Persistence round-trips and legacy
saves without `xp` default cleanly to 0/level 1.

**"increases through play"** — PASS.
- Kill XP: `removeDeadEnemies()` attributes the kill via `enemy.lastDamagedBy`
  (a field set in ~15 damage paths in `simulation.js`) and calls
  `awardXp(killer, killXpForEnemy(enemy))`. `awardXp` is null-safe and ignores
  a non-present/ghost killer.
- Victory bonus: `checkRunTerminalState()` grants `VICTORY_XP_BONUS` (50) to
  every player only on `status === 'victory'`; no bonus on a failed run
  (both verified by tests).
- Level is monotonic (`Math.max(player.level, levelForXp(xp))`).

**"is displayed in the HUD"** — PASS.
`buildPlayerHotSnapshot()` carries `xp`/`level` to the client. The client
`formatPlayerLevel(player)` now reads `player.level` (was hardcoded `return 1`),
floors fractional values, and falls back to 1 for missing/invalid input.
`updateVanguardPortrait(me)` is threaded the local player from both
`main.js:syncVanguardHud` and `stateHandlers.js`. The capture badge still
reads "LV 1" because the smoke run killed 0 enemies (`defeatedEnemies: 0`) —
correct behaviour, not a defect.

**"covered by tests"** — PASS.
39 tests pass (18 server + 21 client). Server tests cover the curve, kill
attribution, no-killer safety, threshold crossing, victory bonus, no-bonus on
failure, persistence round-trip, level/XP reconciliation, and snapshot
inclusion. Client tests cover snapshot read, flooring, and invalid fallback.

## Consistency with design / no regression

The change is additive: two new fields on the player snapshot, a self-contained
XP block in `progression.js`, and a re-pointed HUD formatter. No existing
progression (card grind, currency) is touched. No design.md invariant is
weakened. No debug scenarios were added or changed.

## Code quality

Clean, null-safe helpers; level derived from a single source of truth; sensible
fallbacks throughout. No dead code, no console errors from game logic.

## Remaining gaps

None blocking. The implementation fully and robustly satisfies the binding
acceptance criteria.

(Note — non-blocking: the Goal text suggested level could "gate something
meaningful (e.g. tier-2 unlock pacing)", but that is an illustrative `e.g.` in
the Goal, not part of the AC, which only requires a tracked/displayed/tested
level. Captured as a nit, not a gap.)

VERDICT: PASS