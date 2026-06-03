# Assert enemy + objective preservation in the harness Telepipe capture (treating spawner adds as legitimate)

The round capture (`harness/screenshot.mjs` Telepipe branch) only RECORDS probes,
so the delivered evidence showed 5 enemies pre-suspend and 7 post-resume while the
objective stayed `0/5`, and nothing failed or explained the growth. That growth is
NOT a restore bug: one of the seeded enemies is a `spawner` that emits `skirmisher`
adds over time (`game/server/simulation.js:1727`), each tagged `spawnedBy`, and adds
do not count toward the `defeat_enemies` objective. `restoreRunCheckpoint` restores
the original enemy set by id/hp exactly. Make the capture PROVE this: assert the
checkpoint enemies are preserved across suspend → resume, classify the extra enemies
as spawner adds, assert the objective is unchanged, FAIL the capture on a genuine
mismatch, and record the comparison so the evidence is self-explaining.

## Acceptance Criteria

- The harness `enemyHp` entries in `window.__AUTOGAME_HARNESS_STATE__()` are
  extended ADDITIVELY to expose `type` and `spawnedBy` per enemy (in addition to the
  existing `id`, `hp`, `maxHp`, `revealedUntil`). Existing consumers that read only
  `{id, hp}` (e.g. `game/client/scripts/test-telepipe-suspend-resume.mjs`,
  `test-wyrm-breath.mjs`) keep working unchanged.
- The Telepipe capture branch in `fallbackRecipe()` (`harness/screenshot.mjs`) is
  hardened so the capture VERIFIES preservation rather than only recording it:
  - The PRE-SUSPEND probe/step captures the live enemy set as a baseline
    (`id` → `{hp, type, spawnedBy}`) — this is the suspend checkpoint baseline,
    since the suspended lobby clears live enemies.
  - The SUSPENDED probe/step captures `suspendedRunSummary.objective`
    (`type`, `totalEnemies`, `defeatedEnemies`).
  - After resume (after `waitForGame`), a verification computes and records, into the
    probe/metrics evidence, a `preservation` block with at least:
    `preSuspendEnemyCount`, `resumedEnemyCount`, `preservedIds` (count of pre-suspend
    ids still present after resume), `missingIds` (pre-suspend ids absent after
    resume), `hpChangedIds` (pre-suspend ids whose hp differs after resume),
    `addedEnemies` (resumed ids not present pre-suspend), `addedAllSpawnerAdds`
    (boolean: every added enemy has a truthy `spawnedBy`), and an `objective`
    echo (`totalEnemies`, `defeatedEnemies`).
- The capture FAILS (throws so `metrics.json.ok === false` and the process exits
  non-zero) when ANY of these genuine-mismatch conditions hold, with a clear message:
  - a pre-suspend enemy id is missing after resume (`missingIds` non-empty), OR
  - a preserved enemy's hp changed across resume (`hpChangedIds` non-empty), OR
  - a resumed-only enemy is NOT a spawner add (`addedAllSpawnerAdds === false`) —
    i.e. restore conjured a non-add enemy, OR
  - the suspended objective is not the expected preserved progress:
    `objective.type === 'defeat_enemies'`, `objective.defeatedEnemies === 0`
    (none defeated this run), and `objective.totalEnemies` equals the number of
    ORIGINAL (non-`spawnedBy`) pre-suspend enemies.
- The capture does NOT fail merely because the resumed live enemy count is larger
  than pre-suspend: extra enemies are allowed as long as every one is a spawner add
  (`spawnedBy` set) and all original/checkpoint enemies are preserved by id+hp. The
  normal 5 → 7 spawner-add run PASSES and the `preservation` evidence shows
  `missingIds: []`, `hpChangedIds: []`, `addedAllSpawnerAdds: true`.
- `metrics.json` for a Telepipe capture still contains `"telepipe-ready"` in
  `scenarios`, the `01-in-dungeon` / `02-suspended-lobby` / `03-resumed-dungeon`
  screenshots, and the suspend → resume probes — now plus the `preservation` block —
  so the evidence is self-explaining (it states the original enemies persisted and
  the extras are spawner adds, not a restore regression).
- No server suspend/resume logic is changed; checkpoint/restore is already correct.
- Existing server + client tests still pass and the game starts and loads cleanly
  (no new `pageerrors`).

## Technical Specs

- Edit `game/client/main.js`: in the `__AUTOGAME_HARNESS_STATE__` builder, the
  `enemyHp` map (~line 3976) currently returns `{ id, hp, maxHp, revealedUntil }`.
  Add `type: enemy.type` and `spawnedBy: enemy.spawnedBy ?? null`. Purely additive —
  do not remove or rename existing fields. Server-side `spawnEnemy`
  (`game/server/progression.js:2511`) sets `spawnedBy` only on adds
  (`simulation.js:1742` passes the spawner id); original combat enemies from
  `spawnCombatEnemies` (`progression.js:2799`, `spawnEnemy(...,'…', undefined, …)`)
  have no `spawnedBy`, so `spawnedBy === null` reliably marks an original/quest
  enemy and a truthy value marks a spawner add.
- Edit `harness/screenshot.mjs`, function `fallbackRecipe()`, the `isTelepipeTicket`
  branch (~lines 419–495) and `executeRecipe`:
  - Stash the PRE-SUSPEND enemy baseline and the SUSPENDED objective across steps
    using a module-level Map keyed by player, mirroring the existing
    `cardPressBefore` cross-step pattern (~line 910). Read them from
    `collectProbe`/`__AUTOGAME_HARNESS_STATE__()` (`harnessState.enemyHp` and
    `harnessState.suspendedRunSummary.objective`).
  - Add a single new step action handled in `executeRecipe` (e.g.
    `assertRunPreserved`) placed after the resumed `waitForGame`/`03-resumed-dungeon`
    screenshot. It reads the resumed `enemyHp`, computes the `preservation` block
    described above, pushes it into `probes` (so it lands in `metrics.json`), and
    `throw`s a descriptive Error on any genuine-mismatch condition. Use only this one
    new action; keep the existing recipe step vocabulary otherwise.
  - The throw must propagate out of `executeRecipe` so the top-level `try` sets
    `metrics.error`, leaves `metrics.ok === false`, and `process.exit(1)` fires
    (note: because the plan source is the forced `fallback`, a throw does NOT trigger
    a second fallback attempt — see the `planned.source !== 'fallback'` guard
    ~line 955 — it fails directly, which is the intended behavior here).
- Do NOT modify any server suspend/resume logic, `harness/steps/screenshot.py`, or
  the passed sub-ticket 01/03 smoke files. Do NOT weaken the existing world-stage /
  flare / slope branches or their `!isTelepipeTicket` guards.

## Verification: code
