# Ether Scythe — spectral reaping theme + soul-harvest wisps

Make the Ether Scythe (`harvesting_scythe`) cast read unmistakably as an
ethereal soul-reaping scythe: a ghostly ether-green sweep edged in spectral
violet, a lingering spectral ground decal, and soul-wisp particles drawn off
each struck enemy to echo the card's Magic-Stone-on-hit harvest. Touch ONLY
this card's slash style + the shared swing helper's optional, opt-in harvest
hook so the other per-card animation beads are unaffected.

## Acceptance Criteria

- The `harvesting_scythe` entry in `WEAPON_SLASH_STYLES` keeps an ethereal
  palette: ghostly green body (`color`) with a spectral-violet `emissive`,
  visibly distinct from `iron_sword`, `flame_blade`, and `saber_of_light`
  (colors and cone shapes remain mutually distinct — the existing
  "three blades use mutually distinct colors and arc shapes" test still passes).
- The scythe still spawns a lingering spectral impact decal along its sweep
  (the existing `spawnImpactDecal` behaviour is preserved) and adds no flame
  trail (`spawnProjectileTrail` is NOT called for this card).
- When the `cardUsed` payload carries `hits`, a soul-wisp particle burst is
  spawned at each struck enemy's position (resolved via `ctx.enemyMeshes()`),
  tinted with the scythe's ethereal palette — representing souls being reaped.
  This harvest hook fires ONLY for the scythe, not for the other styled blades.
- The harvest/wisp visuals degrade gracefully (no throw) when the optional ctx
  primitives (`spawnParticleBurst`, `enemyMeshes`) are absent, and when `hits`
  is empty or omitted the swing still renders its arc + decal.
- A client test asserts: scythe palette values, that the lingering decal is
  spawned, that a per-hit wisp burst is spawned for each entry in `hits`, and
  that a hit-free cast still renders without spawning wisps or throwing.

## Technical Specs

- `game/client/cardRenderers.js`:
  - Update the `harvesting_scythe` entry in `WEAPON_SLASH_STYLES` (around
    line 160) to lock in the ethereal palette (ghostly green `color`,
    spectral-violet `emissive`) and keep `decal: true`. Keep its color/cone
    distinct from the other three blades.
  - In `renderWeaponSwing` add an opt-in harvest hook (e.g. a
    `style.soulHarvest` / `style.harvestWisps` flag set only on the scythe)
    that, when `data.hits?.length` and `ctx.enemyMeshes`/`ctx.spawnParticleBurst`
    are available, iterates `data.hits`, resolves each `hit.enemyId` to its mesh
    position (mirror the existing `data.hits` + `enemyMeshes()` pattern near
    line 770), and spawns an ether-tinted `spawnParticleBurst` at each struck
    enemy. Guard every optional primitive so absence is a no-op.
  - Do not change the registration line (`harvesting_scythe: renderWeaponSwing`)
    or any other card's style.
- `game/client/test/cardRenderers.test.js`: extend the existing Ether Scythe
  block (around line 831) with the palette / decal / per-hit-wisp / hit-free
  assertions above. Use the existing `makeCtx` / `renderCardUsed` helpers and
  provide `hits` with `enemyId`s plus matching `enemyMeshes()` entries.

## Verification: code
