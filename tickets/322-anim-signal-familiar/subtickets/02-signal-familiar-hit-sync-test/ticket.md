# Signal Familiar — per-hit signal delivery synced to server hits + client test

Add the per-target half of the Signal Familiar animation: for every enemy in the
server's `data.hits` that still has a live mesh, the familiar sends a **signal
arc/spark** from the cast origin to that enemy, so the visible impacts line up
exactly with the server's radial damage resolution. Then add/extend the client
test asserting the full renderer behaviour (broadcast rings + wisp + per-hit
delivery) and its safe paths. Builds on sub-ticket 01.

## Acceptance Criteria

- For each entry in `data.hits` whose `enemyId` resolves to a live mesh via
  `ctx.enemyMeshes()`, the renderer spawns a signal-delivery effect from the cast
  origin to that enemy position (e.g. `spawnLightningArc(origin→enemyPos)` and/or
  `spawnHitSpark` / `spawnParticleBurst` at the enemy), using the indigo accent
  palette — so on-screen impacts are synced to the instant server resolution.
- Hits whose enemy has no live mesh (already despawned) are skipped without error.
- When `data.hits` is empty/absent the cast still renders (rings + wisp + burst)
  and spawns zero per-hit effects.
- The renderer remains safe when `ctx.enemyMeshes`, `ctx.spawnLightningArc`, or
  `ctx.spawnHitSpark` are absent (guarded helper calls, no throw).
- Signal Familiar's helper-call signature stays **distinct** from `mana_leach`
  (Ether Siphon) and `soul_drain` for an equivalent radial payload — the existing
  distinctness test (`cardRenderers.test.js` ~line 2037) still passes.
- `game/client/test/cardRenderers.test.js` is updated so the `battle_familiar`
  case (~line 1919) asserts: the concentric signal rings fire, the familiar-wisp
  flourish fires, and per-hit signal effects fire once per live-mesh hit; plus a
  case proving missing-mesh / empty-hits paths spawn no per-hit effects and do
  not throw.
- `pnpm test:quick` (client + server vitest) passes; no perf regression.

## Technical Specs

- `game/client/cardRenderers.js`:
  - Extend `renderBattleFamiliar` (from sub-ticket 01) with a per-hit loop over
    `data.hits`, resolving meshes via `ctx.enemyMeshes()` (pattern mirrors
    `renderManaLeach` ~line 1741: `const mesh = meshes[hit.enemyId]; if (!mesh) continue;`),
    building `enemyPos` from `mesh.position` (+~0.6 y), and calling
    `ctx.spawnLightningArc(enemyPos, origin, style)` and/or
    `ctx.spawnHitSpark`/`spawnParticleBurst` at the enemy with the accent palette.
  - Guard every optional helper. Reuse `ATTACK_EFFECT_DURATION` if a duration is
    wanted.
- `game/client/test/cardRenderers.test.js`:
  - Update the existing `battle_familiar` test (~1919) and the distinctness test
    (~2037 / ~2130) to cover the new rings + wisp + per-hit assertions and the
    empty/missing-mesh safe paths. Use the existing `makeCtx()` recorder helper
    (`ctx._calls`).
- Do not modify the server or any other card renderer.

## Verification: code
