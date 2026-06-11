# Soul Drain: drain-tether + life-absorb renderer

Re-theme the Soul Drain (`soul_drain`) resolution VFX so it reads unmistakably
as souls/life being torn out of struck enemies and pulled back into the caster,
instead of the current generic AoE burst it inherited from its base form
(`mana_leach` / Ether Siphon). Add a per-hit drain tether from each struck enemy
back to the cast origin and a life-absorb flourish at the caster that only plays
when the cast actually healed. All built from the existing 315 VFX primitives,
touching only this card's renderer + its test.

## Background (verified, do not re-derive)

- Server emits `CARD_USED` for `soul_drain` (radial AoE branch in
  `game/server/cardEffects.js`) with: `specialEffect: 'soul_drain'`,
  `origin: { x, z }` (the caster's cast position), `radius`,
  `hits: [{ enemyId, hp, magicStonesGained }]`, `magicStonesGained`, and
  `hpHealed` (the heal that was actually applied, may be `0`). The renderer must
  drive its themed visuals off `data.hits` and `data.hpHealed`.
- `windUpMs: 700` is already telegraphed by the shared 307/315 charge telegraph
  during the wind-up (driven by `cardUseState`/`cardWindupCardId` in
  `renderer.js`); soul_drain is an instant radial AoE with no projectile travel
  and no DoT, so there is NO additional timing/projectile work to do here. Do
  not add a projectile-travel or DoT renderer.
- The cast origin IS the caster's position, so drain tethers run from each hit
  enemy's mesh back to `origin`, and the life-absorb flourish belongs at `origin`.

## Acceptance Criteria

- `renderSoulDrain` still spawns the pink soul telegraph ring (`spawnTelegraphRing`)
  at `data.radius` and the primary particle burst (`spawnParticleBurst`) at the
  cast origin, both using the existing Soul Drain palette
  (`SOUL_DRAIN_COLOR 0xe879f9` / `SOUL_DRAIN_EMISSIVE 0xd946ef`).
- For each entry in `data.hits` whose enemy has a live mesh in `ctx.enemyMeshes()`,
  the renderer spawns a drain tether running FROM the enemy's position TO the cast
  origin (e.g. via `ctx.spawnLightningArc(enemyPos, origin, style)` or
  `ctx.spawnProjectileTrail`), tinted with the Soul Drain palette — visibly
  conveying life being pulled into the caster. Hits whose `enemyId` has no mesh
  (already dead/despawned) are skipped without error.
- A life-absorb flourish (e.g. a tighter particle burst / `spawnImpactDecal`) is
  spawned at the cast origin ONLY when `data.hpHealed > 0`; when `hpHealed` is
  `0`, falsy, or absent, no heal flourish is spawned. The flourish must NOT play
  any `heal` (or other extra) sound — heal audio stays in common post-effects.
- The renderer early-returns unchanged when `data.radius === undefined`.
- Every `ctx.*` call is guarded so the renderer never throws when a primitive
  (`spawnTelegraphRing`, `spawnParticleBurst`, `spawnImpactDecal`,
  `spawnLightningArc`/`spawnProjectileTrail`, `enemyMeshes`) is absent
  (graceful-degradation path, matching the existing arcane-radial test).
- The base form `mana_leach` (`renderManaLeach`) is left visually unchanged so the
  evolved Soul Drain is clearly distinct from it.
- `game/client/test/cardRenderers.test.js` is updated so the `soul_drain` cases
  assert: (a) one drain tether per hit-with-mesh ending at the origin, (b) the
  heal flourish appears when `hpHealed > 0` and is absent when `hpHealed` is 0/missing,
  (c) no `heal` sound, and (d) the no-primitives ctx still does not throw.
- `cd game && pnpm test:quick` passes (server + client vitest).

## Technical Specs

- `game/client/cardRenderers.js`:
  - Rewrite `renderSoulDrain` (around line 907). Keep the existing telegraph ring
    + primary burst. Add a helper or inline loop over `data.hits` that looks up
    `ctx.enemyMeshes()?.[hit.enemyId]`, reads `mesh.position` (`{ x, z }`, include
    `y` if finite), and calls `ctx.spawnLightningArc(enemyPos, origin, style)` (or
    `ctx.spawnProjectileTrail`) per live mesh — guard `ctx.spawnLightningArc`/
    `ctx.enemyMeshes` existence. Define a small `SOUL_DRAIN_TETHER_STYLE` constant
    near `SOUL_DRAIN_COLOR`/`SOUL_DRAIN_EMISSIVE` (line ~830) for the tether tint.
  - Gate the existing origin `spawnImpactDecal` (or a dedicated tight burst) on
    `data.hpHealed > 0` so it becomes the life-absorb flourish; keep the
    `spawnParticleBurst` fallback when `spawnImpactDecal` is absent.
  - Do not change `CARD_RENDERERS`/`TYPE_DEFAULT_RENDERERS` registration (line 1590
    `soul_drain: renderSoulDrain` stays) or any other renderer.
- `game/client/test/cardRenderers.test.js`: update the existing
  `soul_drain adds pink drain telegraph…` test (line ~1116) and the
  arcane-radial no-throw test (line ~1140) to cover the new tether + heal-gating
  behavior; add a `hits`-with-mesh case using `makeCtx`'s `enemyMeshes` (add a
  fake enemy mesh with a `position`) and a `hpHealed: 0` case asserting no flourish.

## Verification: code
