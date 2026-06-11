# Reaper's Scythe: reap kill-reward sync + animation tests

Extend `renderReapersScythe` so kill-reward visuals fire in sync with the server's
`reap` effect — soul energy pulled from slain enemies back to the caster plus a
harvest flourish when currency or HP is actually gained — and lock the behavior in
with comprehensive client tests. Depends on sub-ticket 01 (dedicated renderer and
registration must exist).

## Background (verified, do not re-derive)

- On kill, the server accumulates `healOnKill: 8` and `currencyOnKill: 6` inside
  `collectConeHits` (`game/server/simulation.js`) and emits them on `CARD_USED` as
  top-level `hpHealed` and `currencyGained` only when `> 0`
  (`game/server/cardEffects.js` ~561–562). Individual hit entries carry
  `{ enemyId, hp, magicStonesGained }` where `hp <= 0` indicates a killing blow.
- `specialEffect: 'reap'` is metadata only — there is no separate delayed server
  packet. Kill-reward VFX must appear on the same `CARD_USED` frame as the sweep,
  gated on the payload fields above (not guessed from `specialEffect` alone).
- Model the kill layer on Soul Drain's pattern (`renderSoulDrain` in
  `cardRenderers.js`): per-hit soul tether from a live enemy mesh back to the cast
  origin, plus an origin flourish gated on actual rewards. Do **not** duplicate
  common post-effects (`applyHitFlashes`, currency/heal sounds) — those stay in
  `renderCardUsed`.
- Card has no `windUpMs`, no projectile travel, and no DoT — do not add
  `scheduleAfter` delays for the reap layer.

## Acceptance Criteria

- When `data.hits` contains entries whose enemy mesh exists in
  `ctx.enemyMeshes()` and `hit.hp <= 0`, the renderer spawns a soul-harvest tether
  from that enemy's position to the cast origin (via `ctx.spawnLightningArc`,
  `ctx.spawnProjectileTrail`, or equivalent guarded primitive), tinted with the
  Reaper's Scythe palette. Hits with no mesh (already despawned) are skipped
  without error.
- When `data.currencyGained > 0` and/or `data.hpHealed > 0`, a harvest flourish
  (e.g. `spawnParticleBurst` and/or `spawnImpactDecal` with muted gold + soul-green
  accents) spawns at the cast origin. When both are `0`, absent, or falsy, **no**
  harvest flourish is spawned (non-killing swings show the sweep only).
- When `data.hits` is empty or all hits are non-lethal (`hp > 0`), no soul tethers
  and no harvest flourish spawn regardless of `specialEffect`.
- Kill-reward VFX use the same immediate timing as the primary sweep — no
  `scheduleAfter` on tethers or flourishes.
- Every new `ctx.*` call is guarded; the renderer still does not throw when
  optional primitives or `enemyMeshes` are absent.
- `renderReapersScythe` does not alter `harvesting_scythe`, other weapon renderers,
  or shared post-effects in `renderCardUsed`.
- `game/client/test/cardRenderers.test.js` covers:
  - (a) killing hit with mesh → tether spawned toward origin;
  - (b) `currencyGained` / `hpHealed` > 0 → origin harvest flourish present;
  - (c) non-killing swing (`hp > 0`, no `currencyGained`/`hpHealed`) → sweep only,
    no tether/flourish;
  - (d) graceful degradation when `spawnLightningArc`, `enemyMeshes`, etc. are
    absent;
  - (e) `CARD_DEFS.reapers_scythe` has no positive `windUpMs` (instant cast, no
    307 charge telegraph expected).
- Existing weapon-dispatch tests for `reapers_scythe` (~lines 386–411) are updated
  to expect the dedicated renderer's primitive calls rather than a bare single
  `spawnAttackEffect` with default styling.
- `cd game && pnpm test:quick` passes; no per-frame allocation regression (reap
  effects are gated on kill payload, adding nothing on non-killing swings).

## Technical Specs

- **`game/client/cardRenderers.js`**:
  - Extend `renderReapersScythe` (from sub-ticket 01) after the primary sweep block:
    1. Loop `data.hits ?? []`; for each hit with `hit.hp <= 0`, look up
       `ctx.enemyMeshes()?.[hit.enemyId]` and spawn a guarded soul tether to
       `originOf(data)`.
    2. If `(data.currencyGained ?? 0) > 0 || (data.hpHealed ?? 0) > 0`, spawn a
       guarded harvest flourish at the origin (gold + soul-green tint).
  - Add a small `REAPERS_SCYTHE_TETHER_STYLE` / flourish style constant near the
    color constants if helpful.
  - Do not modify `CARD_RENDERERS` registration or other cards.
- **`game/client/test/cardRenderers.test.js`**:
  - Add a `describe('renderCardUsed() — Reaper\'s Scythe')` block (or extend the
    weapon-dispatch section) using `makeCtx` with a fake `enemyMeshes` entry
    (`position: { x, y, z }`).
  - Include kill vs non-kill cases and the no-primitives graceful-degradation case.
  - Update the generic `reapers_scythe` dispatch tests at ~386–411.
- **Server reference (read-only)**: `game/server/test/integration.test.js`
  "Reaper's Scythe grants currency and HP on kill" and
  `game/server/test/collect_cone_kill_rewards.test.js` document the payload
  contract; no server edits.

## Verification: code
