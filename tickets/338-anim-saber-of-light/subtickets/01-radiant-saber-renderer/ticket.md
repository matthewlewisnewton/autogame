# 01 — Dedicated radiant Saber of Light renderer

Give `saber_of_light` its own renderer so its swing reads unmistakably as a
blade of holy light, instead of sharing the generic `renderWeaponSwing` path.
Compose the existing 315 VFX primitives into a bright, radiant pale-gold/white
light arc that is visually distinct from the warm `flame_blade` and the magenta
`excalibur_photon`.

## Acceptance Criteria

- A new `renderSaberOfLight(data, ctx)` function exists in
  `game/client/cardRenderers.js`.
- `CARD_RENDERERS.saber_of_light` is bound to `renderSaberOfLight` (no longer
  to `renderWeaponSwing`); `resolveRenderers('saber_of_light')` returns exactly
  one renderer that is NOT the shared weapon-swing function used by the other
  styled blades and NOT the plain cone default.
- The renderer composes light-themed 315 primitives, each call guarded with
  `if (ctx.<fn>)`: a `spawnAttackEffect` cone swing in a radiant pale-gold/white
  palette, plus a `spawnTelegraphRing` radiant flash and a `spawnParticleBurst`
  halo of bright sparks at the cut. It must use a clearly light/holy color
  (bright pale-gold / near-white emissive), distinct from `flame_blade`'s orange
  and `excalibur_photon`'s magenta.
- The renderer honors `swingCount` (default 1) using the same loop/stagger idiom
  as `renderExcaliburPhoton`/`renderHeavyGreatsword` so multi-swing still works.
- The shared `renderWeaponSwing` function and the other weapons' style entries
  are NOT changed in behavior (the saber's old `WEAPON_SLASH_STYLES` entry may
  be removed since it is now unused, but no other weapon's entry is altered).
- No new exports from `renderer.js`; only existing `ctx` primitives are used.

## Technical Specs

- `game/client/cardRenderers.js`:
  - Add `renderSaberOfLight(data, ctx)` modeled on `renderExcaliburPhoton`
    (lines ~321-363): derive `origin = originOf(data)`,
    `direction = directionOf(data)`, `color = getAccentHex('saber_of_light') ?? <gold>`,
    a near-white `emissive`, `swingCount = data.swingCount || 1`. Inside the
    per-swing closure call `ctx.spawnAttackEffect(origin, direction, {...})` with
    a wide-ish radiant cone, then guarded `ctx.spawnTelegraphRing(impactAt, ...)`
    and `ctx.spawnParticleBurst(impactAt, {...})` for the holy flash + sparks.
    Use `pointAlong(origin, direction, ...)` for the impact point.
  - Change the registration line at ~2220 from
    `saber_of_light: renderWeaponSwing,` to
    `saber_of_light: renderSaberOfLight,`.
  - Remove the now-unused `saber_of_light` entry from `WEAPON_SLASH_STYLES`
    (lines ~171-181) if desired; do not touch the other entries.
- Available `ctx` primitives (see `game/client/renderer.js`): `spawnAttackEffect`,
  `spawnTelegraphRing`, `spawnParticleBurst`, `spawnProjectileTrail`,
  `spawnImpactDecal`, `scheduleAfter`.

## Verification: code
