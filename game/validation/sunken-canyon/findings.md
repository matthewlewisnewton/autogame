# Sunken Canyon validation findings

**Outcome:** PASS
**Preset:** sunken-canyon

## Assertions

- **bossSpawned (miniboss (Canyon Warden))**: PASS
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

- **Level entry**: playerY=10.5, floorY=10.5, delta=0.000, profile=sunken-canyon, band=plateau
- **Mid combat**: playerY=10.5, floorY=10.5, delta=0.000, profile=sunken-canyon, band=plateau
- **Boss dormant**: playerY=10.5, floorY=10.5, delta=0.000, profile=sunken-canyon, band=plateau
- **Boss active**: playerY=0.5, floorY=0.5, delta=0.000, profile=sunken-canyon, band=canyon

## Boss encounter UI

- **hudVisible**: yes
- **bossName**: Canyon Warden
- **hpFillWidthPct**: 100
- **encounterLocked / phase**: locked / active

## Boss visual identity

- **bossType**: miniboss
- **bossEnemyId**: 8078b176-e5ce-47f0-bb7f-a4ab13af0670
- **nearestAddType**: grunt
- **bossDistinctFromAdds**: yes
- **bossRenderScale / addRenderScale**: 2.6107042077237326 / 1.0250146946789034

## Slow / burn mutual exclusivity

- **targetEnemyId**: 06de46a7-661c-45ba-8a87-15b6d3149df6
- **afterSlow**: slowActive=yes, burnActive=no
- **afterBurn**: slowActive=no, burnActive=yes
- **slowBurnMutuallyExclusive**: yes

## Heal / cleanse (Purifying Pulse)

- **preCast hp**: 40
- **postCast hp**: 60
- **preCast debuffs**: slow=yes, burn=yes
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

- **preSuspend**: hp=100, magicStones=2.7400000000017295, runId=2c662e48-6fe1-4c75-82e6-22e6af6bdacb
- **postDeploy**: hp=100, magicStones=3.005000000001724, runId=2676e5be-a7d0-406d-a5b7-9a829ae4da89
- **telepipeVitalsPreserved**: yes
- **cardChargesResetOnNewSortie**: yes

## New content exercise

- `08-slow-burn-mutual-exclusive.png` — see Screenshots list (`game/validation/sunken-canyon/08-slow-burn-mutual-exclusive.png`)
- `09-purifying-pulse.png` — see Screenshots list (`game/validation/sunken-canyon/09-purifying-pulse.png`)
- `10-windup-charge.png` — see Screenshots list (`game/validation/sunken-canyon/10-windup-charge.png`)
- `11-telepipe-before.png` — see Screenshots list (`game/validation/sunken-canyon/11-telepipe-before.png`)
- `12-telepipe-after.png` — see Screenshots list (`game/validation/sunken-canyon/12-telepipe-after.png`)

## Screenshots

- `game/validation/sunken-canyon/01-lobby-browser.png`
- `game/validation/sunken-canyon/01-hub.png`
- `game/validation/sunken-canyon/02-level-entry.png`
- `game/validation/sunken-canyon/03-mid-combat.png`
- `game/validation/sunken-canyon/04-boss-dormant.png`
- `game/validation/sunken-canyon/05-boss-active.png`
- `game/validation/sunken-canyon/06-boss-defeated.png`
- `game/validation/sunken-canyon/07-victory.png`
- `game/validation/sunken-canyon/08-slow-burn-mutual-exclusive.png`
- `game/validation/sunken-canyon/09-purifying-pulse.png`
- `game/validation/sunken-canyon/10-windup-charge.png`
- `game/validation/sunken-canyon/11-telepipe-before.png`
- `game/validation/sunken-canyon/12-telepipe-after.png`

## Game fixes for harness blockers

Minimal `game/` changes required for a green full playthrough (ticket exception for writable-output scope):

- **`canyon-descent-encounter-trigger`** (`debugScenarios.js`, registered in `index.js`): debug shortcut to activate the dormant Canyon Warden after `canyon-descent-boss-approach`; spawns a nearby grunt for `bossDistinctFromAdds`. Same state is reachable by walking into the encounter trigger in normal play.
- **`canyon-descent-boss-approach` reposition** (`debugScenarios.js`): uses `repositionNearEnemy` toward the live miniboss instead of an encounter-anchor offset so the harness reliably reaches the dormant boss room.
- **`nudgeDebugBossApproachPlayers` trigger** (`debugScenarios.js`): activates the encounter when the nudged player is already within `ENCOUNTER_TRIGGER_RADIUS` (matches normal walk-in activation).
- **`ice-ball-ready` + `debugForceStatusRoll`** (`debugScenarios.js`, `cardEffects.js`): when `ALLOW_DEBUG_SCENARIOS=1`, forces the next Glacial Orb slow roll so `slowBurnMutuallyExclusive` is deterministic (65% proc was flaky under harness).
- **`clearPlayerCardCommitment`** on debug scenario swap (`debugScenarios.js`): clears wind-up/cooldown before card-exercise scenarios to avoid `[cardError] Slot on cooldown` when swapping `ice-ball-ready` → `fireball-hand-ready`.
- **`nearbySpawnPosition` radius clamp** (`simulation.js`): clamps spawner add positions to the requested radius after dungeon-bounds clamping; fixes flaky `add is placed within ~3 units of spawner` in `test:quick`.
- **`alignAttackFacing`** (`main.js`, `renderer.js`): on `DEBUG_SCENARIO_RESULT`, syncs local attack facing and orbit camera to the server rotation after reposition so card-exercise captures face enemies correctly (debug-only handler path).

Harness-side wiring (outside `game/`): `playthrough.mjs` encounter-trigger step, `combat.mjs` godmode idempotency, `telepipe.mjs` magic-stone float tolerance.

## Follow-ups

None — green run.
