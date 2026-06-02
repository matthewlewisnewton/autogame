# Cleanup nits from 185-character-models-spike-base-player-model

> **Staleness note.** This follow-up ticket was written against commit
> `7a6ad63` (2026-06-02). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `185-character-models-spike-base-player-model`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Stray placeholder value in pnpm-workspace.yaml
`game/pnpm-workspace.yaml` gained `sharp: set this to true or false` under
`allowBuilds:`. That value is a leftover interactive-prompt placeholder, not a
boolean — it should be a real `true`/`false`. The install/capture happened to
succeed, but the literal string is wrong and confusing.
### Acceptance Criteria
- `allowBuilds.sharp` in `game/pnpm-workspace.yaml` is set to a boolean
  (`true` or `false`), chosen deliberately for whether `sharp`'s build script
  should run.
- `pnpm install` in `game/` still succeeds.

## Trim heavy embedded textures from player.glb before renderer wiring
`player.glb` is ~16 MB because it embeds 7 full-resolution PBR textures
(e.g. `T_Hair_1_Normal` 4.3 MB, `T_Superhero_Male_Normal` 4.2 MB, roughness
3.1 MB) for an ~8.5k-vert "low-poly" spike base. The asset is not loaded yet
(procedural avatar until 187), so there is no current runtime cost, but it
should be optimized (resize/strip/compress textures, or drop unused maps)
before ticket 187 streams it to clients.
### Acceptance Criteria
- `player.glb` texture payload is reduced (downscaled and/or unused maps
  removed, or KTX2/Draco considered) so the file is materially smaller.
- The contract test (`game/client/test/playerModel.glb.test.js`) still passes
  (morph names, bounds unchanged).

## Reconcile triangle count with documented poly budget
Measured mesh is ~14,318 triangles, marginally above the documented
"8,000–14,000 triangles" ceiling in `MODEL_SPIKE.md` / `spike-decision.md`
(which also quote ~8,483 verts). Either widen the documented budget to match
the committed asset or note the triangle figure explicitly so the numbers are
internally consistent.
### Acceptance Criteria
- The poly-budget statement in `game/docs/MODEL_SPIKE.md` and
  `spike-decision.md` matches the committed asset's actual triangle count
  (~14.3k) without an apparent contradiction.
