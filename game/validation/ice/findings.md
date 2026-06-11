# Ice level validation findings

**Outcome:** PASS
**Preset:** ice


## Assertions

- **bossSpawned (permafrost_warden (Permafrost Warden))**: PASS
- **encounterActivated**: PASS
- **bossDefeated**: PASS
- **victoryFired**: PASS
- **bossEncounterUiVisible**: PASS
- **slipperyFloorOk**: PASS
- **glacialSlowApplied**: PASS
- **cardMechanicsOk**: PASS
- **telepipeVitalsPreserved**: PASS
- **cardChargesResetOnFreshSortie**: PASS

## Slippery floor

- **ok**: PASS
- speedWhileHolding: 9.75
- driftAfterRelease: 3.358789775350824
- **directionChangeWhileSliding**: PASS
- **enteredSlipperyBand**: PASS
- Screenshot: `game/validation/ice/03-slippery-floor.png`

## Glacial slow

- **glacialSlowApplied**: PASS
- **debugGodmodeOff**: PASS
- player.slowedUntil: 1781193305892
- HP before/after hit: 100 → 88
- Screenshot: `game/validation/ice/07-glacial-slow.png`

## Card mechanics

- **cardMechanicsOk**: PASS
- **burn**: PASS
- **slow**: PASS
- **cleanse**: PASS
- **windup**: PASS

## Telepipe reset

- preSuspend: HP=60, MS=20, runId=26bb7992-15dd-4723-8300-087965ecb480
- postDeploy: HP=60, MS=20, runId=5b1df098-c310-4d1d-8fd1-dc5a57e4fc6e
- **telepipeVitalsPreserved**: PASS
- **cardChargesResetOnFreshSortie**: PASS

## Console / page errors

None observed.

## Visual notes

No visual glitches recorded by the driver.

## Floor alignment

Ice-cavern layout uses **entry**, **stone**, **ice**, and **ramp** elevation bands; probes record the band at each step.

- **Level entry**: playerY=0.5, floorY=0.5, delta=0.000, profile=ice-cavern, band=entry
- **Mid combat**: playerY=0.5, floorY=0.5, delta=0.000, profile=ice-cavern, band=ice
- **Boss dormant**: playerY=0.5, floorY=0.5, delta=0.000, profile=ice-cavern, band=ice
- **Boss active**: playerY=0.5, floorY=0.5, delta=0.000, profile=ice-cavern, band=ice

## Boss encounter UI

- **hudVisible**: yes
- **bossName**: Permafrost Warden
- **hpFillWidthPct**: 0
- **encounterLocked / phase**: locked / active

## Boss visual identity

- **bossType**: permafrost_warden
- **bossEnemyId**: 178a49d5-6ba7-421d-8949-ab935275c5d5
- **nearestAddType**: grunt
- **bossDistinctFromAdds**: yes
- **bossRenderScale / addRenderScale**: 2.5 / 1.0250146946789034

## Slow / burn mutual exclusivity

No slow/burn card exercise recorded.

## Heal / cleanse (Purifying Pulse)

No Purifying Pulse exercise recorded.

## Wind-up telegraph

No wind-up card exercise recorded.

## Telepipe vitals and new-sortie charges

No canyon telepipe exercise recorded.

## Screenshots

- `game/validation/ice/01-lobby-browser.png`
- `game/validation/ice/01-hub.png`
- `game/validation/ice/02-level-entry.png`
- `game/validation/ice/03-slippery-floor.png`
- `game/validation/ice/07-glacial-slow.png`
- `game/validation/ice/08-card-burn.png`
- `game/validation/ice/04-mid-combat.png`
- `game/validation/ice/05-boss-dormant.png`
- `game/validation/ice/06-boss-active.png`
- `game/validation/ice/09-boss-defeated.png`
- `game/validation/ice/10-victory.png`
- `game/validation/ice/11-telepipe-before.png`
- `game/validation/ice/12-telepipe-after.png`

## Follow-ups

None — green run.
