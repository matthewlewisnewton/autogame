# Rust-Forged Saber: bespoke rust-steel theme renderer

Replace the generic `renderWeaponSwing` path for Rust-Forged Saber (`iron_sword`)
with a dedicated renderer that reads unmistakably as a weathered, rust-forged
melee blade — oxidized rust accents over worn steel, a quick saber slash, and a
metallic spark shower — using only the existing 315 VFX primitives. The 316
foundation gave `iron_sword` a cool slate generic-steel arc; this pass gives it
its own card-specific identity without touching any other weapon renderer.

## Acceptance Criteria

- `iron_sword` is registered in `CARD_RENDERERS` to a new `renderRustForgedSaber`
  function (not `renderWeaponSwing` and not the `weapon` type default
  `renderConeSwings`). `resolveRenderers('iron_sword')[0]` is that dedicated fn.
- The `iron_sword` entry is removed from `WEAPON_SLASH_STYLES` so the card no
  longer shares the generic melee-blade style table path.
- `renderRustForgedSaber` composes at minimum:
  - `ctx.spawnAttackEffect` — a tight saber slash arc with a **warm rust-steel**
    palette (weathered iron body + oxidized rust emissive; e.g. body around
    `0x78716c`–`0xa8a29e`, emissive around `0xb45309`–`0xc2410c`). The palette
    must differ from `flame_blade`'s fiery orange (`0xff7a18` / `0xff3b00`) and
    from `steel_claymore`'s heavy slate cleave.
  - `ctx.spawnParticleBurst` — a metallic spark / rust-flake burst along the
    slash (count ≥ 6).
  - **No** `spawnProjectileTrail` (that reads as fire/energy, not a forged saber).
- Optional but encouraged: a small `spawnImpactDecal` at the strike point for a
  scored-metal ground mark (guarded; absence must not throw).
- Every `ctx.*` call is guarded (`if (ctx.spawnAttackEffect)` etc.) so the
  renderer degrades gracefully when primitives are absent.
- The renderer still falls through to the uniform hit-flash / sound / shockwave
  post-effects in `renderCardUsed` (it only adds the unique slash visual).
- `game/client/test/cardRenderers.test.js`:
  - Update the existing `'Rust-Forged Saber slashes a tight steely arc…'` test
    (~line 857) to assert the new dedicated renderer, rust-steel palette, spark
    burst, and absence of flame trail.
  - Add or update an assertion that `resolveRenderers('iron_sword')[0]` is not
    `renderWeaponSwing`.
- Existing client + server vitest suites still pass; no per-frame allocation
  regressions.

## Technical Specs

- `game/client/cardRenderers.js`:
  - Add a `RUST_FORGED_SABER_STYLE` constant (color, emissive, coneAngle, range,
    fillOpacity, edgeOpacity, sparkCount, sparkSpread, optional decalRadius).
  - Add `renderRustForgedSaber(data, ctx)` beside the other bespoke weapon
    renderers (follow `renderSaberOfLight` / `renderAlloyGreatblade` structure:
    `originOf`, `directionOf`, `pointAlong`, guarded primitive calls).
  - Register `iron_sword: renderRustForgedSaber` under the `// Weapons` section
    of `CARD_RENDERERS` (replace the current `iron_sword: renderWeaponSwing`
    entry).
  - Remove the `iron_sword` key from `WEAPON_SLASH_STYLES`.
  - Do **not** modify `renderWeaponSwing`, other weapons' style entries, server
    files, or `renderer.js`.
- `game/client/test/cardRenderers.test.js`: update/add cases as above using the
  existing `makeCtx` recording pattern and `swingStyle` helper.

## Verification: code
