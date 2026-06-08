# 04 — Update client rendering for healing cards

After sub-tickets 01–03, the server emits `hpGained` for `healing_font`/`divine_grace` and `soul_drain`. Update the client card renderers to show heal-appropriate visuals and sounds instead of the MS-restore ring.

## Acceptance Criteria

- `healing_font` uses a heal renderer that spawns a heal ring and plays the `heal` sound (not `loot`)
- `divine_grace` uses the same heal renderer
- `renderManaRestore` is either renamed to `renderHealRestore` or replaced; the trigger condition checks `hpGained` instead of `magicStonesGained`
- `purifying_pulse` rendering is unchanged (already correct)
- Client card renderer tests pass (updated to expect heal sound and `hpGained` trigger)

## Technical Specs

**`game/client/cardRenderers.js`**:
- Rename `renderManaRestore` to `renderHealRestore` (or create a new function)
- Change the sound from `ctx.playSound('loot')` to `ctx.playSound('heal')`
- Change the trigger from `data.magicStonesGained > 0` to `data.hpGained > 0`
- Update `CARD_RENDERERS` to map `healing_font` and `divine_grace` to the renamed function
- Keep the VFX call (`spawnDivineGraceEffect` or equivalent heal ring) — the golden ring is appropriate for a heal visual

**`game/client/test/cardRenderers.test.js`** — Update:
- `"divine_grace renders the MS restore ring and plays loot when magicStonesGained > 0"` → update to check `hpGained` triggers `heal` sound
- `"divine_grace does not play loot when no magic stones were gained"` → update to check no sound when `hpGained` is 0/absent
- `"healing_font renders MS restore ring and plays loot when magicStonesGained > 0"` → update to check `hpGained` and `heal` sound
- `"healing_font does not play loot when no magic stones were gained"` → update accordingly

## Verification: code
