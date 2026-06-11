# Reaper's Scythe: death-themed sweep renderer + registration

Replace the plain `renderConeSwings` default for `reapers_scythe` with a dedicated
renderer that reads unmistakably as a grim reaper harvest sweep — a wide, dark
scythe arc distinct from the ghostly Ether Scythe (`harvesting_scythe`) — and
wire it into the card registry. The swing must fire synchronously when `CARD_USED`
arrives (this card has no `windUpMs`) and use the server-supplied cone geometry
so the visible arc matches the hit volume.

## Background (verified, do not re-derive)

- `reapers_scythe` is an evolved cone weapon: `attackConeAngle: Math.PI` (180°
  full sweep) in `game/server/progression.js`, default `attackRange` 5
  (`ATTACK_RANGE` in `game/server/config.js`), no `windUpMs`, instant resolution.
- Server `CARD_USED` payload (`game/server/cardEffects.js` ~543) includes
  `origin`, `direction`, `attackRange`, `attackConeAngle`, `hits`,
  `specialEffect: 'reap'`, and optional `hpHealed` / `currencyGained` when kills
  occur. The renderer in this sub-ticket handles the **primary sweep only**;
  kill-reward flourishes are owned by sub-ticket 02.
- Ether Scythe already uses the shared `renderWeaponSwing` helper via
  `WEAPON_SLASH_STYLES.harvesting_scythe` (ghostly green/violet, `coneAngle`
  `2π/3`, hardcoded `range: 6`). Reaper's Scythe must **not** reuse that style
  entry — it needs its own renderer with a darker death palette and must honor
  `data.attackRange` / `data.attackConeAngle` from the payload instead of
  hardcoded shape params.
- Compose only existing 315 VFX primitives (`spawnAttackEffect`,
  `spawnProjectileTrail`, `spawnParticleBurst`, `spawnImpactDecal`,
  `spawnTelegraphRing`); do **not** add branches to `renderer.js`.

## Acceptance Criteria

- `renderReapersScythe` lives in `game/client/cardRenderers.js` and is registered
  as `reapers_scythe: renderReapersScythe` in `CARD_RENDERERS`.
- `resolveRenderers('reapers_scythe')` returns the new renderer, which is **not**
  `renderConeSwings`, `renderWeaponSwing`, or the Ether Scythe renderer
  (`resolveRenderers('harvesting_scythe')[0]`).
- The renderer calls `ctx.spawnAttackEffect(origin, direction, …)` with
  `coneAngle: data.attackConeAngle ?? Math.PI` and
  `range: data.attackRange ?? ATTACK_RANGE` (import `ATTACK_RANGE` from
  `./config.js` or reuse the client constant) so the visible arc matches the
  server hit cone.
- The palette reads as a **reaper/death harvest** weapon — dark base tones with
  pale soul-green or bone-white edge glow and optional muted gold ember accents
  (clearly different from Ether Scythe's `0x86efac` / `0x8b5cf6` ghost palette).
- At least one additional composed primitive beyond the core cone (e.g. a wisp
  `spawnProjectileTrail`, soul `spawnParticleBurst` along the arc, or a lingering
  `spawnImpactDecal`) makes the sweep feel like a scythe harvest, not a generic
  wedge.
- The swing resolves **immediately** on `CARD_USED`: no `ctx.scheduleAfter` delay
  on the primary arc, no projectile-travel staging, and no wind-up charge telegraph
  (card has no `windUpMs`).
- Optional `ctx.*` calls are guarded (`if (ctx.spawnParticleBurst)`) so partial
  ctx objects never throw.
- `harvesting_scythe` renderer and `WEAPON_SLASH_STYLES.harvesting_scythe` are
  untouched.
- `game/client/test/cardRenderers.test.js` adds or updates a focused case asserting
  the dedicated renderer registration, distinct palette/geometry from Ether Scythe,
  and that `spawnAttackEffect` receives `coneAngle: Math.PI` when
  `attackConeAngle: Math.PI` is in the payload. Tests that currently use
  `reapers_scythe` as the "plain cone default" baseline must be migrated to compare
  against `TYPE_DEFAULT_RENDERERS.weapon` (`renderConeSwings`) directly so this
  sub-ticket leaves the suite green.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **`game/client/cardRenderers.js`**:
  - Add `REAPERS_SCYTHE_COLOR` / `REAPERS_SCYTHE_EMISSIVE` constants (suggested:
    dark slate + pale soul-green or bone-white edge; tune to taste but must differ
    from `WEAPON_SLASH_STYLES.harvesting_scythe`).
  - Implement `renderReapersScythe(data, ctx)` near the other weapon renderers.
    Use `originOf(data)`, `directionOf(data)`, and payload geometry
    (`data.attackConeAngle`, `data.attackRange`). Compose `spawnAttackEffect` plus
    at least one optional primitive (trail, burst, or decal along the sweep).
    Do **not** gate on kill rewards here (sub-ticket 02).
  - Register `reapers_scythe: renderReapersScythe` under `// Weapons` in
    `CARD_RENDERERS`.
- **`game/client/test/cardRenderers.test.js`**:
  - Add `Reaper's Scythe` describe block or extend weapon-dispatch tests with
    registration + palette + geometry assertions via `makeCtx`.
  - Replace `reapers_scythe` "plain baseline" references in distinct-renderer
    tests (~lines 130, 138, 147) with direct `renderConeSwings` /
    `TYPE_DEFAULT_RENDERERS.weapon` comparison.
- **Server reference (read-only)**: instant cone branch in
  `game/server/cardEffects.js`; no server edits in this sub-ticket.

## Verification: code
