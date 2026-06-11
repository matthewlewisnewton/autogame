# Thunderbird chain-lightning strike: themed arcs + timing sync

Replace the shared `renderChainLightning` entry in the Thunderbird registry with a dedicated `renderThunderbirdStrike` so minion chain attacks read as a storm bird loosing forked lightning — distinct from Stormwing Drone's single arc (`renderStormEagleStrike`) and the Voltaic Chain spell (`renderChainLightningArcs`). Sync arc lifetimes and per-hop sequencing to the server's instant hit resolution and `attackIntervalMs: 1500`.

## Background (verified, do not re-derive)

- When a thunderbird minion attacks in range, `simulation.js` pushes a `_pendingMinionBreaths` / `cardUsed` payload with `cardId: 'thunderbird'`, `specialEffect: 'chain_lightning'`, `origin` (minion XZ), `direction` (3D aim), `hits`, and `chainSegments` (minion → first target → each chained target). All damage resolves **instantly** on the server tick — there is no projectile travel phase and **no** `attackWindupMs` / `windUpMs` on this card.
- `attackIntervalMs` is **1500** (`cardStats.json`); the renderer must not schedule effects beyond one interval window for a single attack event.
- The shared `renderChainLightning` currently draws arcs (or a legacy bolt) plus a generic `spawnAttackEffect` and an extra `playSound('enemyHit')` that duplicates `applyHitFlashes`. Thunderbird polish should drop the duplicate sound and compose richer per-hop feedback.

## Acceptance Criteria

- Add `renderThunderbirdStrike(data, ctx)` and change the registry to `thunderbird: [renderThunderbirdSummon, renderThunderbirdStrike]`. The shared `renderChainLightning` function stays in the file for any other `specialEffect: 'chain_lightning'` paths but is **no longer** registered on `thunderbird`.
- Renderer early-returns when `!data.origin` or `!data.hits?.length` (summon-only payloads are handled by sub-ticket 01).
- **Segment path** (`data.chainSegments` present): for each segment, call `ctx.spawnLightningArc(seg.from, seg.to, THUNDERBIRD_ARC_STYLE)` where `THUNDERBIRD_ARC_STYLE` reuses the Thunderbird palette (`color: 0x38bdf8`, `emissive: 0x0ea5e9`, `duration: ATTACK_EFFECT_DURATION`). At each `seg.to`, spawn a guarded `spawnParticleBurst` and/or `spawnImpactDecal` (sky-blue sparks) matching the Voltaic Chain endpoint treatment but with Thunderbird colors.
- **Legacy fallback** (no `chainSegments`): call `ctx.spawnChainLightningEffect(origin, direction)` toward the primary hit, still using Thunderbird palette overrides if the primitive accepts a style.
- **Per-hop timing**: the first segment's arc + endpoint burst fire **immediately** on `CARD_USED` receipt (server instant resolution). Each subsequent hop may be deferred via `ctx.scheduleAfter(hopDelayMs * index, …)` where `hopDelayMs` is a short constant (e.g. 80–120 ms) so multi-target chains read sequentially; total scheduled delay for two hops must stay well under `ATTACK_EFFECT_DURATION` (600 ms).
- **Origin flare**: a brief `spawnAttackEffect` or compact `spawnParticleBurst` at the minion `origin` on the first hop only — not a full weapon wind-up telegraph (no `windUpMs` on this card).
- **No duplicate hit audio**: do **not** call `ctx.playSound('enemyHit')` inside the renderer (`applyHitFlashes` in `renderCardUsed` already handles it).
- **Per-enemy hit sync**: for each entry in `data.hits` with a live mesh in `ctx.enemyMeshes()`, spawn an immediate accent flash burst at the enemy position (`spawnParticleBurst` and/or rely on `applyHitFlashes` — do not double-flash).
- All optional ctx helpers are guarded; `chain_lightning` spell renderer (`renderChainLightningArcs`) and `storm_eagle` strike renderer are untouched.
- Depends on sub-ticket 01 (`THUNDERBIRD_SUMMON_STYLE` / accent constants); may land in the same PR if 01 is already merged.

## Technical Specs

- **`game/client/cardRenderers.js`**:
  - Implement `renderThunderbirdStrike` near `renderChainLightning` (~L1093–1105). Reuse `spawnChainSegmentArcs` logic or inline equivalent with `THUNDERBIRD_ARC_STYLE` instead of `CHAIN_LIGHTNING_ARC_STYLE`.
  - Import `ATTACK_EFFECT_DURATION` from `./config.js` for arc `duration` and hop scheduling bounds.
  - Update `CARD_RENDERERS.thunderbird` (~L1800) to `[renderThunderbirdSummon, renderThunderbirdStrike]`.
  - Leave `renderChainLightning` exported only if tests still reference it directly; otherwise keep as internal helper.
- **Server reference** (read-only): `game/server/simulation.js` thunderbird block (~L3490–3568) for payload shape; `game/shared/cardStats.json` `thunderbird` stats (`attackRange: 11`, `attackDamage: 20`, `attackIntervalMs: 1500`, `chainRadius: 5`, `maxChainTargets: 2`).
- Do **not** modify `game/server/**`, `renderer.js` primitive internals, or `enemySync.js` `MINION_HIT_VFX` fallback in this ticket.

## Verification: code
