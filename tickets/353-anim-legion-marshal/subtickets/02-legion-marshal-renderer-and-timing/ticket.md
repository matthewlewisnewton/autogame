# Legion Marshal — renderer composition and server timing sync

Rewrite `renderUndeadCommander` to compose the sub-ticket 01 rally primitive with 315 VFX primitives so the Legion Marshal cast reads unmistakably as an undead commander deploying a skeletal legion, with animation timing synced to the server's instant creature resolution. Depends on sub-ticket 01 (`spawnLegionMarshalRallyEffect`).

## Background (verified, do not re-derive)

- Server `cardEffects.js` `undead_commander` branch resolves **instantly** (no `windUpMs` on this card): it pushes the commander minion at the cast origin and two `skeleton_knight` minions at fixed offsets in a single `CARD_USED` emit with `{ origin, minionId, summonedMinions: [{ id, x, z }, …] }`.
- Client `minionSync.js` scales all new minion meshes in over `MINION_SUMMON_IN_MS` (750 ms) from the moment they first appear in state — VFX for commander and skeletons should fire **synchronously** on `CARD_USED` receipt (no artificial travel delay, no `scheduleAfter` deferral).
- There is **no** projectile, DoT, or 307 wind-up charge telegraph for this card (`getCardDef('undead_commander').windUpMs` is absent).
- Debug scenario `legion-marshal-ready` preloads the card for harness QA.

## Acceptance Criteria

- `renderUndeadCommander` calls `ctx.spawnLegionMarshalRallyEffect(origin, 2, commanderStyle)` at the cast origin for the commander rally flourish (replacing the generic `spawnSummonEffect` call).
- When `data.minionId` is present, `ctx.spawnMinionSummonInEffect(origin, commanderStyle)` fires at the cast origin for the commander minion (matching the `storm_eagle` / `renderWyrmSummon` summon-in pattern); larger `radius` (~1.6) than skeleton flourishes.
- For each entry in `data.summonedMinions`, the renderer fires **synchronously** (no `scheduleAfter`):
  - `ctx.spawnMinionSummonInEffect({ x, z }, skeletonStyle)` with smaller radius (~0.85) and bone/purple palette.
  - A ground bone burst via `ctx.spawnParticleBurst({ x, y: 0.35, z }, …)`.
  - A necrotic rally tether from the commander origin to the skeleton spawn point via `ctx.spawnLightningArc(commanderOrigin, skeletonOrigin, tetherStyle)` (or `ctx.spawnProjectileTrail`), guarded when the helper is absent.
- All `ctx.*` calls are guarded so the renderer never throws when optional primitives are absent.
- `undead_commander: renderUndeadCommander` registration in `CARD_RENDERERS` is unchanged.
- `main.js` `cardRenderCtx` exposes `spawnLegionMarshalRallyEffect` from `renderer.js`.
- Renderer does **not** call `spawnProjectileTrail` for travel (server has no travel phase) and does **not** introduce `scheduleAfter` delays.
- `pnpm test:quick` passes (sub-ticket 03 owns extended assertions; this ticket must not break existing `undead_commander` tests).

## Technical Specs

- **`game/client/cardRenderers.js`**:
  - Rewrite `renderUndeadCommander` (~L939): keep `UNDEAD_COMMANDER_COLOR` / `UNDEAD_COMMANDER_EMISSIVE` constants; define a `LEGION_MARSHAL_TETHER_STYLE` for rally arcs.
  - Commander path: `spawnLegionMarshalRallyEffect` + `spawnMinionSummonInEffect` at `originOf(data)` when `data.minionId` is set.
  - Skeleton loop over `data.summonedMinions || []`: per-spawn `spawnMinionSummonInEffect`, `spawnParticleBurst`, and `spawnLightningArc` from commander origin to skeleton `{ x, z }`.
  - Remove the legacy `spawnSummonEffect(origin, 2, …)` commander call.
  - Update the ctx interface comment block (~L21) to document `spawnLegionMarshalRallyEffect`.
- **`game/client/main.js`**: import and wire `spawnLegionMarshalRallyEffect` on `cardRenderCtx`.
- **Server reference (read-only)**: `cardEffects.js` ~L1351–1400; `cardStats.json` `undead_commander` has `summonSkeletonCount: 2`, no `windUpMs`. Do not modify server code.
- Do **not** modify `spawnLegionMarshalRallyEffect` internals (owned by sub-ticket 01) or weaken sub-ticket 03 test coverage.

## Verification: code
