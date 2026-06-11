# Solar Edge — dedicated renderer & server timing sync

Give `flame_blade` (Solar Edge) a dedicated card renderer that composes sub-ticket 01's solar impact primitive with the 315 shared VFX helpers, replacing the generic `renderWeaponSwing` path. The swing must read unmistakably as a solar blade (gold-white radiant edge + orange corona) and land **synchronously** on `CARD_USED` receipt — the server already defers resolution by `windUpMs` (650 ms); the client swing must not add further `scheduleAfter` delay. Depends on sub-ticket 01.

## Background (verified, do not re-derive)

- Server resolves `flame_blade` as a melee cone weapon with `windUpMs: 650` (`game/shared/cardStats.json`). Damage and `CARD_USED` emit only after the wind-up completes (`card_windup_resolution.test.js`).
- The 315 charge-up telegraph during wind-up is driven by server `cardWindupUntil` state in `renderer.js` — **not** by this card renderer.
- `CARD_USED` payload includes `attackRange` and `attackConeAngle` (defaults: `ATTACK_RANGE` 5, `ATTACK_CONE_ANGLE` π/2). The current `renderWeaponSwing` entry uses a narrower authored arc (π/4) and **ignores** the server geometry — the polish pass must honor the payload so the visible sweep matches the hit volume.
- `flame_blade` has no burn DoT, projectile travel, or multi-swing stagger on the server; a single immediate swing on `CARD_USED` is correct.
- `magma_greatsword` shares a similar orange palette but is a heavier greatsword cleave (`renderHeavyGreatsword`); Solar Edge must remain visually distinct (solar gold core, lighter arc, corona impact — not a molten ground-shatter).

## Acceptance Criteria

- A new card-specific renderer function `renderSolarEdge(data, ctx)` exists in `game/client/cardRenderers.js` and is registered in `CARD_RENDERERS` as `flame_blade: renderSolarEdge`.
- `resolveRenderers('flame_blade')` returns exactly one renderer that is **not** the shared `renderWeaponSwing`.
- The renderer composes:
  - `ctx.spawnAttackEffect` — solar arc using gold-white body + orange emissive, with `coneAngle` and `range` driven by `data.attackConeAngle` / `data.attackRange` (falling back to `ATTACK_CONE_ANGLE` / `ATTACK_RANGE` when absent).
  - `ctx.spawnProjectileTrail` — solar streak along the arc reach.
  - `ctx.spawnSolarEdgeImpactFlourish` — sub-ticket 01 primitive at the strike point.
  - `ctx.spawnTelegraphRing` — brief corona pulse at the strike point (distinct radius from the impact flourish).
- Per-hit feedback: when `data.hits` contains enemy ids with live meshes, call `ctx.spawnHitSpark` at each struck enemy position (guarded; mirrors fire-spell per-hit spark pattern).
- **Timing**: the full swing fires **synchronously** on `CARD_USED` — no `ctx.scheduleAfter` / deferred delay on the default single-swing path (wind-up is already server-side).
- Every `ctx.*` call is guarded so optional primitives never throw.
- `flame_blade` is removed from the `WEAPON_SLASH_STYLES` table and from the `renderWeaponSwing` registration entry.
- `game/client/main.js` `cardRenderCtx` exposes `spawnSolarEdgeImpactFlourish` from `renderer.js`.
- The ctx interface comment block at the top of `cardRenderers.js` documents `spawnSolarEdgeImpactFlourish`.
- No changes to server code, other weapon renderers, or unrelated VFX primitives.

## Technical Specs

- **`game/client/cardRenderers.js`**:
  - Add `SOLAR_EDGE_*` palette constants and `renderSolarEdge(data, ctx)`.
  - Honor server cone geometry: `const coneAngle = data.attackConeAngle ?? ATTACK_CONE_ANGLE; const range = data.attackRange ?? ATTACK_RANGE;`.
  - Register `flame_blade: renderSolarEdge` in `CARD_RENDERERS`; remove `flame_blade` from `WEAPON_SLASH_STYLES` and the `renderWeaponSwing` map entry.
- **`game/client/main.js`**: import `spawnSolarEdgeImpactFlourish` from `renderer.js` and wire it on `cardRenderCtx`.
- **Server reference** (read-only): `game/server/cardEffects.js` weapon branch (~L393–568) for `CARD_USED` payload fields; `game/server/test/card_windup_resolution.test.js` for `windUpMs` 650 timing. Do not modify server files.
- Do **not** add test assertions in this sub-ticket (owned by sub-ticket 03).

## Verification: code
