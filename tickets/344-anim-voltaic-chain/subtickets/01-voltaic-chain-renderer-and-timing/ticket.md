# Voltaic Chain — renderer composition and timing sync

Rewrite `renderChainLightningArcs` so the Voltaic Chain spell reads unmistakably as forked lightning chaining between enemies — visually distinct from Thunderbird minion strikes (`renderThunderbirdStrike`) and the shared legacy `renderChainLightning` path — with per-hop sequencing that matches the server's instant multi-target resolution.

## Background (verified, do not re-derive)

- On cast, `cardEffects.js` resolves all chain hits **instantly** via `collectChainLightningHits`, then emits `CARD_USED` with `cardId: 'chain_lightning'`, `specialEffect: 'chain_lightning'`, `origin`, `direction`, `attackRange`, `chainRadius`, `hits`, and `chainSegments` (caster → primary → each chained target). There is **no** `projectileTravelMs`, **no** DoT/lingering effect, and **no** `windUpMs` on this card.
- The current `renderChainLightningArcs` fires every `spawnLightningArc` synchronously and uses the same palette/timing pattern as Thunderbird. Polish should add a spell-specific cast flourish, chain-radius telegraph, sequenced hop delays, and endpoint bursts snapped to live enemy meshes.
- `applyHitFlashes` in `renderCardUsed` already handles per-hit emissive flashes and `enemyHit` audio — the renderer must **not** duplicate `playSound('enemyHit')`.

## Acceptance Criteria

- Refactor `renderChainLightningArcs` (keep the same export name and `CARD_RENDERERS.chain_lightning` registration) with dedicated `VOLTAIC_CHAIN_*` style constants derived from `getAccentHex('chain_lightning')` (`0x38bdf8` / `0x0ea5e9` fallbacks).
- **Segment path** (`data.chainSegments` present):
  - **Cast (t = 0):** spawn an immediate `spawnTelegraphRing` at the caster `origin` with radius `data.chainRadius ?? 5` and a brief origin `spawnParticleBurst` (electric spark channel) using the Voltaic palette.
  - **Per-hop sequencing:** fire hop 0 immediately on `CARD_USED` receipt; defer hops `i ≥ 1` via `ctx.scheduleAfter(VOLTAIC_CHAIN_HOP_DELAY_MS * i, …)` where `VOLTAIC_CHAIN_HOP_DELAY_MS` is a short constant (80–120 ms). Total scheduled delay for two hops must stay well under `ATTACK_EFFECT_DURATION` (600 ms).
  - Each hop calls `ctx.spawnLightningArc(seg.from, seg.to, VOLTAIC_CHAIN_ARC_STYLE)` where `VOLTAIC_CHAIN_ARC_STYLE` includes `duration: ATTACK_EFFECT_DURATION`.
  - Endpoint feedback at each hop: resolve the struck enemy mesh via `data.hits[index]` + `ctx.enemyMeshes()` when available (use mesh `y` when finite); fall back to `seg.to`. Spawn `spawnParticleBurst` and/or `spawnImpactDecal` with Voltaic styling.
- **Legacy fallback** (no `chainSegments`): call `ctx.spawnChainLightningEffect(origin, direction)` plus a cast telegraph/burst at `origin`; do not throw when optional primitives are absent.
- **No duplicate hit audio:** do **not** call `ctx.playSound('enemyHit')` inside the renderer.
- All optional `ctx.*` helpers are guarded (`spawnLightningArc`, `spawnTelegraphRing`, `spawnParticleBurst`, `spawnImpactDecal`, `spawnChainLightningEffect`, `scheduleAfter`, `enemyMeshes`).
- `renderThunderbirdStrike`, `renderChainLightning`, and all other card renderers remain unchanged. `spawnChainSegmentArcs` may be inlined or left for legacy paths but must not change Thunderbird behavior.
- `chain_lightning` has **no** positive `windUpMs` — no 307 charge telegraph is expected for this card.

## Technical Specs

- **`game/client/cardRenderers.js`**:
  - Replace the body of `renderChainLightningArcs` (~L1049–1075) and add `VOLTAIC_CHAIN_ARC_STYLE`, `VOLTAIC_CHAIN_HOP_DELAY_MS`, and small helpers (e.g. `voltaicChainEndpointBurst`, `voltaicChainCastFlourish`) near the existing `CHAIN_LIGHTNING_ARC_STYLE` block (~L1023).
  - Import `ATTACK_EFFECT_DURATION` from `./config.js` if not already in scope.
  - Reuse `originOf`, `directionOf`, `getAccentHex`, and the `enemyWorldPosition` helper pattern from `renderThunderbirdStrike`.
  - Keep `CARD_RENDERERS.chain_lightning: renderChainLightningArcs` (~L2036).
- **Server reference** (read-only): `game/server/cardEffects.js` `chain_lightning` branch (~L1076–1139) for payload shape; `game/shared/cardStats.json` `chain_lightning` (`attackRange: 9`, `chainRadius: 5`, `maxChainTargets: 2`, `damage: 22`).
- Do **not** modify `game/server/**`, `game/client/renderer.js` primitive internals, or Thunderbird/Legion Marshal chain renderers in this ticket.

## Verification: code
