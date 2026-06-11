# Archive Wyrm theme VFX composition

Extend `renderArchiveWyrmSummon` and `renderArchiveWyrmBreath` so the deploy
and channeled fire breath read unmistakably as **Archive Wyrm** — an evolved,
scholarly purple wyrm exhaling archive-fire — not a recolored Vault Wyrm. Compose
additional 315 primitives into summon and breath-start paths so the visual
identity matches the card name, purple accent (`#9333ea`), and fire-breath
creature type.

## Acceptance Criteria

- **Summon:** `renderArchiveWyrmSummon` composes at least three 315 primitives
  on deploy: `spawnMinionSummonInEffect` (wide archive flourish),
  `spawnTelegraphRing` (purple arcane seal at origin), and
  `spawnParticleBurst` (ember motes). Palette uses archive purple accent
  (`getAccentHex('ancient_wyrm')` → `0x9333ea`) with warm fire emissive
  (`0xef4444` / `0xff3b00`) — distinct from Vault Wyrm's green melee accent.
- **Breath start:** on `breathPhase !== 'tick'` with `specialEffect === 'fire_breath'`,
  `renderArchiveWyrmBreath` composes a richer channeled cone than the migrated
  baseline: existing `spawnAttackEffect` cone **plus** at least two of
  `spawnFireTrailEffect`, `spawnProjectileTrail`, or `spawnDragonsBreathEffect`
  along the breath direction from the airborne origin (`origin.y` when present).
  Purple emissive (`0x9333ea`) edges the red fire core (`0xef4444`).
- **Breath tick:** `breathPhase === 'tick'` still skips duplicate cones and only
  emits per-hit `spawnHitSpark` / `spawnParticleBurst` at enemy mesh positions
  (unchanged guard).
- **Distinction from Vault Wyrm:** Archive Wyrm summon and breath-start primitive
  mixes differ from `dungeon_drake` — Archive must use at least one primitive
  Vault does not (`spawnFireTrailEffect`, `spawnDragonsBreathEffect`, or
  `spawnProjectileTrail` on breath start).
- **Enemy-sync fallback:** `game/client/renderer/enemySync.js`
  `MINION_DAMAGE_VFX.ancient_wyrm.spawn` uses the archive purple + fire palette
  and includes a `spawnFireTrailEffect` or `spawnParticleBurst` along the attack
  direction so off-tick HP-drop feedback matches the breath theme (guarded with
  primitive presence checks).
- All new primitive calls are guarded (`if (ctx.spawn…)`) so renderers degrade
  gracefully when a primitive is absent.
- New/updated tests in `game/client/test/cardRenderers.test.js` assert the
  archive summon and breath-start primitive calls, purple/fire palette values,
  and that `dungeon_drake` does **not** emit the archive-only primitives.
- No new per-frame allocations in `updateAttackEffects`; reuse existing effect
  pools. Existing client + server vitest suites still pass.

## Technical Specs

- `game/client/cardRenderers.js`:
  - In `renderArchiveWyrmSummon`, after `spawnMinionSummonInEffect`, add
    `spawnTelegraphRing(origin, radius, { color, emissive })` and
    `spawnParticleBurst` with archive palette; tune `ARCHIVE_WYRM_SUMMON_STYLE`
    for a wider, more ember-heavy flourish than Vault Wyrm.
  - In `renderArchiveWyrmBreath`, on breath start only, call
    `ctx.spawnFireTrailEffect` or `ctx.spawnDragonsBreathEffect` (imported via
    ctx if wired in `renderer.js` card-used ctx) along
    `pointAlong(origin, direction, attackRange)` with
    `coneAngle: data.attackConeAngle ?? Math.PI / 3` and
    `range: data.attackRange ?? 10`.
  - Keep `fillOpacity` / `edgeOpacity` tuned for a wide π/3 airborne cone.
  - Do not modify `renderWyrmSummon`, `renderWyrmAttack`, or any other card's
    renderer registration.
- `game/client/renderer.js` (card-used ctx wiring only if needed):
  - Ensure `spawnFireTrailEffect` / `spawnDragonsBreathEffect` are exposed on
    the `cardUsed` render ctx passed to `renderCardUsed` (add to ctx factory if
    missing).
- `game/client/renderer/enemySync.js`:
  - Update `MINION_DAMAGE_VFX.ancient_wyrm.spawn` to add a fire-trail or burst
    along `dir` with archive palette.
- `game/client/test/cardRenderers.test.js`:
  - Extend Archive Wyrm summon test to assert `spawnTelegraphRing` and archive
    purple colors.
  - Extend breath-start test to assert fire-trail / dragons-breath primitive and
    purple emissive on the cone.
  - Add assertion that `dungeon_drake` breath-start does not call archive-only
    trail helpers.

## Verification: code
