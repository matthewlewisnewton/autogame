# Rooms validation findings

**Outcome:** PASS
**Preset:** rooms


## Assertions

- **bossSpawned (annex_overseer (Annex Overseer))**: PASS
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

- **Level entry**: playerY=0.5, floorY=0.5, delta=0.000, profile=crowded, band=vault-entry
- **Mid combat**: playerY=0.5, floorY=0.5, delta=0.000, profile=crowded, band=vault-entry
- **Boss dormant**: playerY=0.5, floorY=0.5, delta=0.000, profile=crowded, band=vault-entry
- **Boss active**: playerY=0.5, floorY=0.5, delta=0.000, profile=crowded, band=(none)

## Boss encounter UI

- **hudVisible**: yes
- **bossName**: Annex Overseer
- **hpFillWidthPct**: 100
- **encounterLocked / phase**: locked / active

## Boss visual identity

- **bossType**: annex_overseer
- **bossEnemyId**: 9dfb71b0-a060-4e27-be5c-05f2c56cb3a4
- **nearestAddType**: skirmisher
- **bossDistinctFromAdds**: yes
- **bossRenderScale / addRenderScale**: 2.4000000953674316 / 1.7513414081284946

## Slow / burn mutual exclusivity

- **targetEnemyId**: bf46eec7-e47f-4789-82a5-2d32d8598bf4
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

- **preSuspend**: hp=100, magicStones=4.465000000002609, runId=6ef8a3c5-51cc-4213-903c-da2cd360781d
- **postDeploy**: hp=100, magicStones=4.715000000002604, runId=df1005ea-832b-4b44-b988-296035ddaecf
- **telepipeVitalsPreserved**: yes
- **cardChargesResetOnNewSortie**: yes

## New content exercise

- `08-slow-burn-mutual-exclusive.png` — see Screenshots list (`game/validation/rooms/08-slow-burn-mutual-exclusive.png`)
- `09-purifying-pulse.png` — see Screenshots list (`game/validation/rooms/09-purifying-pulse.png`)
- `10-windup-charge.png` — see Screenshots list (`game/validation/rooms/10-windup-charge.png`)
- `11-telepipe-before.png` — see Screenshots list (`game/validation/rooms/11-telepipe-before.png`)
- `12-telepipe-after.png` — see Screenshots list (`game/validation/rooms/12-telepipe-after.png`)

## Screenshots

- `game/validation/rooms/01-lobby-browser.png`
- `game/validation/rooms/01-hub.png`
- `game/validation/rooms/02-level-entry.png`
- `game/validation/rooms/03-mid-combat.png`
- `game/validation/rooms/04-boss-dormant.png`
- `game/validation/rooms/05-boss-active.png`
- `game/validation/rooms/06-boss-defeated.png`
- `game/validation/rooms/07-victory.png`
- `game/validation/rooms/08-slow-burn-mutual-exclusive.png`
- `game/validation/rooms/09-purifying-pulse.png`
- `game/validation/rooms/10-windup-charge.png`
- `game/validation/rooms/11-telepipe-before.png`
- `game/validation/rooms/12-telepipe-after.png`

## Follow-ups

None — green run.
