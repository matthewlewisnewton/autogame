# Senior Review — Key Item: Rally Cry (134-key-item-rally-cry)

## Runtime health
`metrics.json` reports `"ok": true`, `pageerrors: []`, no `harness_failure`, and a
clean `playing` phase with two connected players and an initialized scene.
`console.log` contains only benign lobby/auth noise (a 409 Conflict on a
re-claimed resource) and the normal `[initScene]` lines — no `pageerror`,
no `[fatal]`. The game starts and loads cleanly. ✔

## Acceptance criteria

### Cooldown ~10s
PASS. `KEY_ITEM_DEFS.rally_cry.cooldownMs` was changed from `30000` to `10000`
(`game/server/progression.js:681`). The handler sets
`player.keyItemCooldownUntil = now + (def.cooldownMs || 10000)`
(`game/server/index.js:2998`), and the shared cooldown gate at lines 2841-2847
rejects an early re-use with `on_cooldown`. The test
`applies no heal and burns a ~10s cooldown; a second immediate use is on_cooldown`
asserts `cooldownUntil ∈ [before+10000, after+10000]` and that the second cast
returns `on_cooldown`.

### ~+10% move speed, no self-stack
PASS. `speedMultiplier: 1.1` (progression.js). The buff is **assigned**, not
multiplied, onto each affected player (`p.rallySpeedMultiplier = multiplier`),
so re-casting holds it at ~1.1 rather than compounding. `simulation.js`
applies it in `applyPlayerMovement`:
`if (now < (player.rallyUntil || 0)) playerStep *= (player.rallySpeedMultiplier || 1)`.
The old heal fields (`hpRegenPerTick`, `tickIntervalMs`) were removed — matching
the ticket's "no heal." The test `re-using while active re-applies the same
multiplier (no self-stack)` confirms the multiplier stays ~1.1 (< 1.2), and the
`applies no heal…` test confirms HP is unchanged after a cast.

### Tests: two players faster delta; expires after 4s
PASS. `durationMs: 4000` (progression.js); handler sets `rallyUntil = now + durationMs`.
- `two players in radius get a larger move delta than the un-buffed baseline`
  measures real per-tick movement deltas via `applyPlayerMovement` for both the
  caster and an ally, asserting each buffed delta ≈ 1.1× its own baseline and
  `affected === 2`.
- `the buff expires after its duration — movement returns to baseline` confirms
  boosted movement while active and a return to baseline once `rallyUntil` is in
  the past.
- Supporting coverage: out-of-radius ally untouched (`affected === 1`), and
  guard_block (×0.2) composes sanely with rally (×1.1).
All 7 rally_cry tests pass locally (verified: `7 passed | 41 skipped`).

### Goal — applies to all players in radius including caster, no heal
PASS. The handler iterates `Object.values(state.players)`, skips dead/extracted
players, and buffs every player within `radius` (8m) by Euclidean distance —
including the caster (distance 0). No HP mutation occurs.

## Debug scenario (`rally-cry-ready`)
PASS. Added to the `DEBUG_SCENARIOS` allow-set and gated: the `debugScenario`
socket handler enforces `isDebugScenarioAllowed(socket)` before
`applyDebugScenario`, and `applyDebugScenario` re-checks `DEBUG_SCENARIOS.has(name)`.
The URL parameter is the only entry point.
- Normal path still reachable: the scenario only equips `rally_cry` with a
  cleared cooldown — exactly the state a player reaches by equipping the Rally
  Cry key item in the lobby and entering a run.
- No invariants bypassed: the scenario does not cast the buff itself; casting
  still flows through the normal `useKeyItem` handler, which enforces
  dead/extracted/cooldown checks and net-replicates via `stateUpdate`.

## Consistency / regressions
The change is additive and follows the established per-key-item pattern in the
`useKeyItem` handler (cooldown gate → per-item block → `stateUpdate` broadcast).
New fields `rallyUntil`/`rallySpeedMultiplier` are initialized in both
`buildPlayerRecord` and `initializePlayerForActiveRun`, so they reset correctly
on new runs. No existing behavior is altered beyond the guard_block movement
line, which now composes the rally multiplier (verified by test). No design.md
or requirements.md regression.

## Remaining gaps
None blocking. The implementation fully and robustly satisfies the acceptance
criteria, the game runs cleanly, and the tests are thorough and pass.

VERDICT: PASS
