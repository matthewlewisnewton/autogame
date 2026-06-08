# Minion summon-in foundation

Add a shared client-side summon-in flourish that plays whenever a creature card deploys a minion. Today `cardUsed` for creatures (payload includes `minionId`) renders only the generic card sound — minion meshes pop in at full scale with no VFX. This sub-ticket introduces the reusable primitive and wires it for every creature summon before the per-family polish passes (02–05) layer type-specific styling on top.

## Acceptance Criteria

- `game/client/renderer.js` exports a `spawnMinionSummonInEffect(origin, style)` helper that composes existing 315 primitives (`spawnSummonEffect`, `spawnParticleBurst`, and optionally `spawnTelegraphRing`) with accent-driven `color`/`emissive` and reuses the pooled `activeEffects` path (no per-frame allocation spikes).
- `game/client/config.js` defines `MINION_SUMMON_IN_MS` (expand + settle duration) used by both the ground VFX and the mesh scale-in.
- `game/client/cardRenderers.js` adds a default creature summon renderer (e.g. `renderCreatureSummon`) registered in `TYPE_DEFAULT_RENDERERS.creature` that runs on `cardUsed` when `data.minionId` is present, calling `ctx.spawnMinionSummonInEffect` at `data.origin` with accent styling from `getAccentHex(data.cardId)`.
- `game/client/renderer.js` minion mesh sync scales a newly created minion mesh from ~0 → 1 over `MINION_SUMMON_IN_MS` on first appearance (track per-minion spawn start time; do not re-trigger on reconnect/resync).
- `undead_commander` skeleton spawns (`data.summonedMinions`) each get their own summon-in flourish at their spawn coordinates in addition to the commander ring (existing `renderUndeadCommander` may delegate to the shared helper).
- `game/client/main.js` passes `spawnMinionSummonInEffect` through `cardRenderCtx`.
- Vitest in `game/client/test/cardRenderers.test.js` asserts a creature `cardUsed` with `minionId` invokes the summon helper (recorded via `makeCtx`); a renderer/minion test asserts new minions enter with a spawn timestamp or initial scale < 1.
- Existing `cardRenderers.test.js` cases (including “vanilla creature spawns” for `battle_familiar`) are updated to expect the new summon flourish rather than sound-only.

## Technical Specs

- `game/client/renderer.js`: implement `spawnMinionSummonInEffect`; in the minion sync loop (~line 5809), detect first frame for each `minion.id`, record spawn time, and lerp mesh `scale` during `MINION_SUMMON_IN_MS`.
- `game/client/config.js`: add `MINION_SUMMON_IN_MS` (~600–900 ms).
- `game/client/cardRenderers.js`: add `renderCreatureSummon`, wire `TYPE_DEFAULT_RENDERERS.creature`, extend `renderUndeadCommander` to call the shared helper for skeleton positions; document the helper on the ctx interface comment block.
- `game/client/main.js`: import and expose `spawnMinionSummonInEffect` on `cardRenderCtx`.
- `game/client/test/cardRenderers.test.js`: extend `makeCtx`, add summon-in assertions, update the `battle_familiar` expectation.

## Verification: code
