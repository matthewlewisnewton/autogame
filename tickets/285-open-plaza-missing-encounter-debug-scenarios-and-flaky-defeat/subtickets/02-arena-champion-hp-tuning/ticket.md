# Tune arena_champion boss HP so a full-HP defeat is achievable, and document it

The open-plaza validation flakes because a full-HP `arena_champion` cannot be
brought to 0 within the 180s `defeatBoss` timeout even in god-mode. The
`arena_champion` base HP is 500 — markedly higher than every other stage boss
(miniboss 300, annex_overseer 320, spire_warden 420). Reduce `arena_champion`
HP into line with the other bosses so a real full-HP defeat is achievable at the
driver's attack DPS, and document the boss-HP relationship and rationale.

## Acceptance Criteria

- `arena_champion` base `hp` in `game/server/simulation.js` `ENEMY_DEFS` is
  reduced to be no greater than the highest other stage boss (`spire_warden`,
  currently 420) — i.e. `arena_champion.hp <= 420` and strictly less than its
  current 500.
- The reduction is a deliberate, documented choice: a note in
  `game/docs/design.md` records the per-boss HP values (miniboss / annex_overseer /
  spire_warden / arena_champion), states that `arena_champion` was the outlier at
  500, and explains the new value relative to driver attack DPS over the 180s
  defeat window.
- No regression to boss identity/role: `arena_champion` remains the open-plaza
  stage boss (attack style, range, reward drops in `config.js` unchanged unless a
  reward change is explicitly justified in the same design.md note).
- A vitest server test asserts the new `arena_champion.hp` value and that it does
  not exceed `spire_warden.hp` (guards against the value drifting back up).
- Existing arena / stage-boss tests (`arena_trials_tier2.test.js`,
  `stage_boss_defeat.test.js`, `stage_boss_kill_count.test.js`,
  `stage_boss_objective.test.js`, `miniboss_hp_scaling.test.js`) still pass with
  the new value.
- `pnpm test` (server + client vitest) passes.

## Technical Specs

- `game/server/simulation.js`: lower `ENEMY_DEFS.arena_champion.hp` (line ~905)
  from 500 to a value `<= 420`. Pick the value to match the documented DPS
  reasoning (e.g. align with `spire_warden` at 420, or lower if the design note
  justifies it). Leave the other `arena_champion` fields (chaseSpeed,
  attackDamage, attackStyle, attackConeAngle, attackRange) unchanged.
- `game/docs/design.md`: add a short subsection documenting the four stage-boss
  HP values and the arena_champion retune rationale (driver DPS vs 180s window).
- `game/server/test/`: add or extend a test (e.g. alongside
  `miniboss_hp_scaling.test.js` or a new `arena_champion_hp.test.js`) asserting
  `ENEMY_DEFS.arena_champion.hp` equals the new value and
  `<= ENEMY_DEFS.spire_warden.hp`.
- Do NOT change `harness/validate` driver navigation or `validation/**` here;
  this sub-ticket is the server-side HP/tuning + documentation only. The
  deterministic `arena-trials-boss-low-hp` shortcut (sub-ticket 01) covers
  validation determinism independently.

## Verification: code
