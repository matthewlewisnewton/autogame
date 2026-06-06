# Sunken Canyon validation findings

**Outcome:** PASS
**Preset:** sunken-canyon

## Assertions

- **bossSpawned (miniboss (Canyon Warden))**: PASS
- **encounterActivated**: PASS
- **bossDefeated**: PASS
- **victoryFired**: PASS

## Console / page errors

None observed.

## Visual notes

No visual glitches recorded by the driver.

## Harness-blocking fixes (`game/server/debugScenarios.js`)

Two debug-scenario bugs blocked the full playthrough driver until patched (minimal server edits; normal gameplay unchanged).

1. **`canyon-descent-near-adds` — unreachable per-band adds** (`03-mid-combat.png`): The scenario previously split adds across elevation bands. The harness clears adds via lock-on + swings on the start plateau only; adds on lower bands were never in range, so `addsTimeoutMs` fired before `canyon-descent-boss-approach`. **Fix:** cluster every live add on `firstRoomPosition()` (wounded, shields stripped) with band-correct floor Y at each cluster position so the driver can clear the full pack without crossing bands or the `canyon_monolith` trigger.

2. **`canyon-descent-boss-low-hp` — invalid `active → active` re-activation** (`05-boss-active.png` → `06-boss-defeated.png`): The harness activates the encounter before applying this scenario; unconditional `activateEncounter` threw on an already-active encounter, so `debugScenarioResult` never returned `ok: true` and the boss-low-HP shortcut failed. **Fix:** call `activateEncounter` only when `isEncounterDormant(state.run)`; call `lockEncounter` only when `!state.run.encounter.locked`.

## Floor alignment

- **Level entry**: playerY=10.5, floorY=10.5, delta=0.000, profile=sunken-canyon, band=plateau
- **Mid combat**: playerY=10.5, floorY=10.5, delta=0.000, profile=sunken-canyon, band=plateau
- **Boss dormant**: playerY=10.5, floorY=10.5, delta=0.000, profile=sunken-canyon, band=plateau
- **Boss active**: playerY=0.5, floorY=0.5, delta=0.000, profile=sunken-canyon, band=canyon

## Screenshots

- `game/validation/sunken-canyon/01-lobby-browser.png`
- `game/validation/sunken-canyon/01-hub.png`
- `game/validation/sunken-canyon/02-level-entry.png`
- `game/validation/sunken-canyon/03-mid-combat.png`
- `game/validation/sunken-canyon/04-boss-dormant.png`
- `game/validation/sunken-canyon/05-boss-active.png`
- `game/validation/sunken-canyon/06-boss-defeated.png`
- `game/validation/sunken-canyon/07-victory.png`

## Follow-ups

None for gameplay — green run after the two debug-scenario fixes above.
