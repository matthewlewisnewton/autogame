## Game fixes for harness blockers

Changes required to make `pnpm validate:open-plaza --steps full` reach a green 11-assertion
run (ticket exception for writable-output / documented harness-blocker scope). The full
new-content pipeline had never actually been executed against the open-plaza preset before
this run, so these blockers only surfaced now.

### `game/` (arena debug scenarios)

- **`arena-trials-telepipe-ready`** (`debugScenarios.js`): now seeds the already-depleted
  pre-suspend state directly (magic stones `20` < `STARTING_MAGIC_STONES` 49, a partially-spent
  `ice_ball`, a full-charge Telepipe, plus the existing `_msRegenGraceUntil` grace), instead of
  relying on the harness to deplete by casting. On the single-room open plaza the boss sits at the
  centre dais, so the driver's god-moded depletion attacks reached and killed it — ending the run
  in victory before any mana was spent. Seeding the depleted state is not a green-fake: the
  telepipe assertions still genuinely verify that suspend → abandon → fresh redeploy **preserves**
  the depleted vitals (287) and **resets** card charges on the new sortie (289).
- **`setupArenaTrialsTier2StageBossDebug`** (`debugScenarios.js`): preserves the player's current
  HP / magic stones on deploy (defaulting to MAX only when unset), mirroring
  `canyon-descent-tier-2`. The previous unconditional MAX reset wiped the depleted mana on the
  telepipe new-sortie redeploy, failing the vitals-preservation check.
- **`arena-trials-near-adds`** (`debugScenarios.js`): clusters the adds (and the player) in the
  room corner farthest from the boss. Open-plaza is one room with the boss near its centre, so
  clustering at the room centre left the player inside `ENCOUNTER_TRIGGER_RADIUS` when the last add
  died and auto-activated the encounter before the approach step (`Expected dormant encounter, got
  active`).

(`arena-trials-encounter-trigger` and the other arena scenarios from sub-ticket 01 were already
correct — the trigger scenario already spawns the visual add the `bossDistinctFromAdds` probe
needs; it simply was not being invoked for this preset. See harness wiring below.)

### Harness-side wiring (outside `game/`, documented per ticket)

- **`harness/validate/lib/cardExercise.mjs`**: the slow/burn, heal-cleanse and wind-up card
  exercises hard-required `layout.profile === 'sunken-canyon'`, so they could never start on
  open-plaza. Generalized to a shared `waitForPlayingOnProfile(page, layoutProfile)` helper driven
  by `preset.layoutProfile` (sunken-canyon keeps its strict guard).
- **`harness/validate/playthrough.mjs`**: threads `preset.layoutProfile` into the card exercises,
  and generalizes the encounter-activation branch to use `preset.encounterTriggerScenario` (the
  scenario that activates the boss AND leaves a live add for `bossDistinctFromAdds`) instead of a
  hard-coded canyon-only special case.
- **`harness/validate/presets/open-plaza.mjs`**: adds
  `encounterTriggerScenario: 'arena-trials-encounter-trigger'`.
