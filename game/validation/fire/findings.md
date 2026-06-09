# Fire level validation findings

**Outcome:** PASS
**Preset:** fire


## Assertions

- **layoutDeployed**: PASS
- **enemiesCleared**: PASS
- **victoryFired**: PASS
- **emberBurnApplied**: PASS
- **cardMechanicsOk**: PASS
- **telepipeVitalsPreserved**: PASS
- **cardChargesResetOnFreshSortie**: PASS

## Ember burn

- **burnTickDamageApplied**: PASS
- **emberBurnApplied**: PASS
- **debugGodmodeOff**: PASS
- player.burningUntil: 1780969988360
- HP delta across burn ticks: -13
- Screenshot: `game/validation/fire/04-ember-burn.png`

## Card mechanics

- **cardMechanicsOk**: PASS
- **burn**: PASS
- **slow**: PASS
- **cleanse**: PASS
- **windup**: PASS

## Stage boss gap

`ember_descent` tier 1 has **no stage boss** — encounter UI and distinct boss visuals are N/A (tickets 283/284). Victory is driven by the `defeat_enemies` objective only.

## Telepipe reset

- preSuspend: HP=60, MS=20, runId=0f781ee6-5f8f-4522-a729-9599ef65fac1
- postDeploy: HP=60, MS=20, runId=b25dfae9-6e48-4bec-9832-25b5fc2a1b1b
- **telepipeVitalsPreserved**: PASS
- **cardChargesResetOnFreshSortie**: PASS

## Console / page errors

None observed.

## Visual notes

No visual glitches recorded by the driver.

## Floor alignment

Fire-cavern layout uses **rim**, **ramp**, and **basin** elevation bands; probes record the band at each step.

- **Level entry**: playerY=10.5, floorY=10.5, delta=0.000, profile=fire-cavern, band=rim
- **Mid combat**: playerY=10.5, floorY=10.5, delta=0.000, profile=fire-cavern, band=rim

## Screenshots

- `game/validation/fire/01-lobby-browser.png`
- `game/validation/fire/01-hub.png`
- `game/validation/fire/02-level-entry.png`
- `game/validation/fire/03-mid-combat.png`
- `game/validation/fire/04-ember-burn.png`
- `game/validation/fire/05-card-burn.png`
- `game/validation/fire/06-objective-complete.png`
- `game/validation/fire/07-victory.png`
- `game/validation/fire/08-telepipe-before.png`
- `game/validation/fire/09-telepipe-after.png`

## Follow-ups

None — green run.
