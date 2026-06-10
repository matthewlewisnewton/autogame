# Open Plaza validation findings

**Outcome:** PASS
**Preset:** open-plaza


## Assertions

- **bossSpawned (arena_champion (Arena Champion))**: PASS
- **encounterActivated**: PASS
- **bossDefeated**: PASS
- **victoryFired**: PASS

## Console / page errors

None observed.

## Visual notes

No visual glitches recorded by the driver.

## Floor alignment

- **Level entry**: playerY=0.5, floorY=0.5, delta=0.000, profile=open-plaza, band=(none)
- **Mid combat**: playerY=1.6, floorY=1.6, delta=0.000, profile=open-plaza, band=(none)
- **Boss dormant**: playerY=1.6, floorY=1.6, delta=0.000, profile=open-plaza, band=(none)
- **Boss active**: playerY=0.5, floorY=0.5, delta=0.000, profile=open-plaza, band=(none)

## Boss encounter UI

- **hudVisible**: yes
- **bossName**: Trial Warden
- **hpFillWidthPct**: 100
- **encounterLocked / phase**: locked / active

## Boss visual identity

- **bossType**: arena_champion
- **bossEnemyId**: 16db9282-9b25-4230-a5e1-caf31f1321e3
- **nearestAddType**: grunt
- **bossDistinctFromAdds**: yes
- **bossRenderScale / addRenderScale**: 3 / 1.025014694678903

## Slow / burn mutual exclusivity

- **targetEnemyId**: 165ec049-04b4-45b5-a414-54f0a0a87217
- **afterSlow**: slowActive=yes, burnActive=no
- **afterBurn**: slowActive=no, burnActive=yes
- **slowBurnMutuallyExclusive**: yes

## Heal / cleanse (Purifying Pulse)

- **preCast hp**: 40
- **postCast hp**: 60
- **preCast debuffs**: slow=no, burn=yes
- **postCast debuffs**: slow=no, burn=no
- **healCleanseApplied**: yes

## Wind-up telegraph

- **cardId**: magma_greatsword
- **cardUseState**: windup
- **cardWindupCardId**: magma_greatsword
- **inputLocked**: yes
- **telegraphVisible**: yes
- **windupTelegraphActive**: yes

## Telepipe vitals and new-sortie charges

- **preSuspend**: hp=100, magicStones=20, runId=192f7538-3c11-4315-8ec1-8a0d57dbea94
- **postDeploy**: hp=100, magicStones=20, runId=05f238fa-3cff-4631-9482-246982b0c80b
- **telepipeVitalsPreserved**: yes
- **cardChargesResetOnNewSortie**: yes

## New content exercise

- `08-slow-burn-mutual-exclusive.png` — see Screenshots list (`game/validation/open-plaza/08-slow-burn-mutual-exclusive.png`)
- `09-purifying-pulse.png` — see Screenshots list (`game/validation/open-plaza/09-purifying-pulse.png`)
- `10-windup-charge.png` — see Screenshots list (`game/validation/open-plaza/10-windup-charge.png`)
- `11-telepipe-before.png` — see Screenshots list (`game/validation/open-plaza/11-telepipe-before.png`)
- `12-telepipe-after.png` — see Screenshots list (`game/validation/open-plaza/12-telepipe-after.png`)

## Screenshots

- `game/validation/open-plaza/01-lobby-browser.png`
- `game/validation/open-plaza/01-hub.png`
- `game/validation/open-plaza/02-level-entry.png`
- `game/validation/open-plaza/03-mid-combat.png`
- `game/validation/open-plaza/04-boss-dormant.png`
- `game/validation/open-plaza/05-boss-active.png`
- `game/validation/open-plaza/06-boss-defeated.png`
- `game/validation/open-plaza/07-victory.png`
- `game/validation/open-plaza/08-slow-burn-mutual-exclusive.png`
- `game/validation/open-plaza/09-purifying-pulse.png`
- `game/validation/open-plaza/10-windup-charge.png`
- `game/validation/open-plaza/11-telepipe-before.png`
- `game/validation/open-plaza/12-telepipe-after.png`

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

## Follow-ups

None — green run.
