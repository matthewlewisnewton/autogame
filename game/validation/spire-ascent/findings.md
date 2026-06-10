# Spire Ascent validation findings

**Outcome:** PASS
**Preset:** spire-ascent


## Assertions

- **bossSpawned (spire_warden (Summit Warden))**: PASS
- **encounterActivated**: PASS
- **bossDefeated**: PASS
- **victoryFired**: PASS
- **bossEncounterUiVisible**: PASS
- **bossDistinctFromAdds**: PASS
- **slowBurnMutuallyExclusive**: PASS
- **healCleanseApplied**: PASS
- **windupTelegraphActive**: PASS
- **telepipeVitalsPreserved**: PASS
- **cardChargesResetOnNewSortie**: PASS

## Console / page errors

None observed.

## Visual notes

No visual glitches recorded by the driver.

## Floor alignment

- **Level entry**: playerY=0.5, floorY=0.5, delta=0.000, profile=spire-ascent, band=tier
- **Mid combat**: playerY=0.5, floorY=0.5, delta=0.000, profile=spire-ascent, band=tier
- **Boss dormant**: playerY=0.5, floorY=0.5, delta=0.000, profile=spire-ascent, band=tier
- **Boss active**: playerY=10.5, floorY=10.5, delta=0.000, profile=spire-ascent, band=tier

## Boss encounter UI

- **hudVisible**: yes
- **bossName**: Summit Warden
- **hpFillWidthPct**: 100
- **encounterLocked / phase**: locked / active

## Boss visual identity

- **bossType**: spire_warden
- **bossEnemyId**: fca3903c-6423-42b5-a18d-7c1ad6f1fedd
- **nearestAddType**: grunt
- **bossDistinctFromAdds**: yes
- **bossRenderScale / addRenderScale**: 2.4000000953674316 / 1.0250146946789016

## Slow / burn mutual exclusivity

- **targetEnemyId**: 15a437ce-27f7-4bad-b10d-c579ae65a8d6
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

- **preSuspend**: hp=100, magicStones=16.679999999998124, runId=135ba20e-2834-4d4b-9f70-e1f4940912c2
- **postDeploy**: hp=100, magicStones=16.939999999998072, runId=cf6a116e-cd4e-48f0-94ac-2540a72151c1
- **telepipeVitalsPreserved**: yes
- **cardChargesResetOnNewSortie**: yes

## New content exercise

- `08-slow-burn-mutual-exclusive.png` — see Screenshots list (`game/validation/spire-ascent/08-slow-burn-mutual-exclusive.png`)
- `09-purifying-pulse.png` — see Screenshots list (`game/validation/spire-ascent/09-purifying-pulse.png`)
- `10-windup-charge.png` — see Screenshots list (`game/validation/spire-ascent/10-windup-charge.png`)
- `11-telepipe-before.png` — see Screenshots list (`game/validation/spire-ascent/11-telepipe-before.png`)
- `12-telepipe-after.png` — see Screenshots list (`game/validation/spire-ascent/12-telepipe-after.png`)

## Screenshots

- `game/validation/spire-ascent/01-lobby-browser.png`
- `game/validation/spire-ascent/01-hub.png`
- `game/validation/spire-ascent/02-level-entry.png`
- `game/validation/spire-ascent/03-mid-combat.png`
- `game/validation/spire-ascent/04-boss-dormant.png`
- `game/validation/spire-ascent/05-boss-active.png`
- `game/validation/spire-ascent/06-boss-defeated.png`
- `game/validation/spire-ascent/07-victory.png`
- `game/validation/spire-ascent/08-slow-burn-mutual-exclusive.png`
- `game/validation/spire-ascent/09-purifying-pulse.png`
- `game/validation/spire-ascent/10-windup-charge.png`
- `game/validation/spire-ascent/11-telepipe-before.png`
- `game/validation/spire-ascent/12-telepipe-after.png`

## Game fixes for harness blockers

Minimal `game/` changes required for this green full playthrough (ticket writable-output exception):

- **`spire-ascent-telepipe-ready`** (`debugScenarios.js`): clears minions, pins telepipe slot 0 + `throw_rock` slot 1 for `depleteRunResources`, syncs deck — mirrors canyon telepipe QA path on spire_ascent Tier 2.
- **Card-exercise scenarios** (`debugScenarios.js`, `main.js`): floor-aligned grunts, slot-cooldown reset, player reposition toward slowed target in `fireball-hand-ready`; synchronous `alignAttackFacing`/cooldown clear for `ice-ball-ready` / `fireball-hand-ready` on `DEBUG_SCENARIO_RESULT`.
- **`liveSpireAscentAdds`** (`debugScenarios.js`): boss-approach gate matches harness `addTypes` (grunt/skirmisher/miniboss/spawner); variant spawns like `void_seraph` no longer block approach after harness `defeatAdds`.

## Follow-ups

None — green run.
