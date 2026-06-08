# Weapon slash foundation + standard melee blades

Replace the generic `renderConeSwings` default for standard melee weapons with a
shared, accent-themed slash helper that composes the 315 VFX primitives (cone
swing + slash trail + spark burst + impact decal), and give three standard
blades distinct slash visuals: Rust-Forged Saber (`iron_sword`), Solar Edge
(`flame_blade`), and Ether Scythe (`harvesting_scythe`).

## Acceptance Criteria
- A new shared helper (e.g. `renderWeaponSwing`) lives in
  `game/client/cardRenderers.js` and composes existing ctx primitives
  (`spawnAttackEffect`, `spawnProjectileTrail`, `spawnParticleBurst`,
  `spawnImpactDecal`) — it must NOT add new effect functions to `renderer.js`.
- A per-weapon style table (e.g. `WEAPON_SLASH_STYLES`) maps each weapon's
  cardId to its distinct slash parameters (at minimum a distinct `color` /
  `emissive` accent and at least one differing shape parameter such as
  `coneAngle` or `range`).
- `iron_sword`, `flame_blade`, and `harvesting_scythe` are each registered in
  `CARD_RENDERERS` (directly or via the shared helper) and resolve to a
  card-specific renderer rather than the `renderConeSwings` type default —
  `resolveRenderers('iron_sword')` etc. return the new renderer.
- The three weapons produce visibly distinct slashes: Rust-Forged Saber a tight
  steely arc, Solar Edge a warm fiery arc with a flame trail, Ether Scythe a
  wide ghostly sweeping arc. Their style entries use different colors and at
  least one different shape parameter from each other.
- Each renderer still falls through to the uniform hit-flash / sound / shockwave
  post-effects in `renderCardUsed` (i.e. it only adds the unique slash visual,
  matching the documented "renderers describe unique visuals only" contract).
- `getAccentHex` is honored when a card has an accent entry; weapons without an
  accent entry supply their own distinct color in the style table.
- New/updated tests in `game/client/test/cardRenderers.test.js` assert each of
  the three cardIds resolves to a card-specific renderer and that firing each
  through a recording ctx emits its distinct primitive calls / colors.
- Existing client + server vitest suites still pass; no per-frame allocation
  regressions (the helper reuses the existing pooled primitives, allocating
  nothing on a per-frame basis).

## Technical Specs
- `game/client/cardRenderers.js`:
  - Add `renderWeaponSwing(data, ctx)` that looks up the firing card's style in
    a new `WEAPON_SLASH_STYLES` map (keyed by cardId) and composes:
    `ctx.spawnAttackEffect(origin, direction, { color, emissive, coneAngle, range, ... })`
    plus optional `ctx.spawnProjectileTrail`, `ctx.spawnParticleBurst`, and
    `ctx.spawnImpactDecal` along the swing using the existing `originOf`,
    `directionOf`, and `pointAlong` helpers. Guard optional primitives with
    `if (ctx.spawnProjectileTrail)` etc. as the existing renderers do.
  - Register `iron_sword`, `flame_blade`, `harvesting_scythe` in
    `CARD_RENDERERS` (under the `// Weapons` section) pointing at the shared
    helper. Keep `renderConeSwings` as the `weapon` type default for unlisted
    weapons.
  - Suggested distinct styling: `iron_sword` slate steel (~`0x94a3b8`), tight
    cone; `flame_blade` warm orange (~`0xff7a18`/`0xff3b00`) with a flame
    `spawnProjectileTrail`; `harvesting_scythe` ghostly green/violet, wider
    `coneAngle`, longer `range`. Tune values to taste.
- `game/client/test/cardRenderers.test.js`: extend the existing recording-ctx
  tests (use `makeCtx`) to cover the three new weapon cardIds.

## Verification: code
