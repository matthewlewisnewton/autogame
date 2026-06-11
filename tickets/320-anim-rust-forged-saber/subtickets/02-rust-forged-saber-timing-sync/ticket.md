# Rust-Forged Saber: server geometry + instant-hit timing sync

Align `renderRustForgedSaber` timing and strike geometry with the server's actual
weapon resolution so the visible slash covers exactly what hits and lands on the
same beat as damage. `iron_sword` is an **instant** weapon (no `windUpMs`, no
projectile travel, no DoT): the server applies cone damage and emits `CARD_USED`
synchronously on use. The renderer must honor the payload's `attackRange` and
`attackConeAngle` (defaults `ATTACK_RANGE` = 5 and `ATTACK_CONE_ANGLE` = π/2 from
`game/server/config.js`) and fire its first swing immediately — no artificial
delay before the slash.

## Background (verified, do not re-derive)

- Server weapon branch in `game/server/cardEffects.js` (~line 544) emits
  `CARD_USED` for `iron_sword` with `attackRange`, `attackConeAngle`, `origin`,
  `direction`, `hits`, and `swingCount` (defaults to 1). No `projectileTravelMs`,
  no `dotIntervalMs`, no wind-up fields on the payload.
- `iron_sword` has **no** `windUpMs` in `game/shared/cardStats.json` (confirmed
  by `card_windup_state.test.js` / `cards.test.js`). The 307/315 charge telegraph
  does **not** apply; do not add one.
- The pre-320 `WEAPON_SLASH_STYLES.iron_sword` used `coneAngle: Math.PI / 5` and
  `range: 4`, which **under-covers** the server's π/2 cone at range 5. This
  sub-ticket fixes that mismatch.

## Acceptance Criteria

- `renderRustForgedSaber` drives its `spawnAttackEffect` `range` from
  `data.attackRange` when finite, falling back to the style default only when
  absent.
- `renderRustForgedSaber` drives its `spawnAttackEffect` `coneAngle` from
  `data.attackConeAngle` when finite, falling back to the style default only when
  absent.
- Spark burst and optional impact decal placement scale with the resolved
  `range` (e.g. `pointAlong(origin, direction, range * 0.6)` or strike-point at
  full `range`), so impact VFX move outward when `attackRange` increases.
- The first (and only, for `swingCount === 1`) swing fires **synchronously** on
  `CARD_USED` — no `ctx.scheduleAfter` for the primary slash. Only additional
  swings (`swingCount > 1`, which `iron_sword` does not use) may stagger.
- No projectile-travel delay, wind-up telegraph, or DoT layering is added for
  this card.
- `game/client/test/cardRenderers.test.js`:
  - Assert firing `iron_sword` with `attackRange: 5` and
    `attackConeAngle: Math.PI / 2` (mirror the real server payload) passes those
    values through to `spawnAttackEffect`.
  - Assert a longer `attackRange` (e.g. 9) produces a larger cone `range` and
    pushes spark/decal placement farther along the facing direction (same pattern
    as the `saber_of_light` range-scaling test ~line 1524).
  - Assert `ctx._calls` contains **no** `scheduleAfter` for a default
    `swingCount: 1` use.
  - Assert `CARD_DEFS.iron_sword.windUpMs` is undefined / `getCardDef('iron_sword').windUpMs`
    is falsy (instant weapon contract).
- Existing client + server vitest suites still pass; no perf regression.

## Technical Specs

- `game/client/cardRenderers.js`:
  - Update `renderRustForgedSaber` (added in sub-ticket 01) to resolve:
    ```js
    const range = Number.isFinite(data.attackRange) ? data.attackRange : style.range;
    const coneAngle = Number.isFinite(data.attackConeAngle) ? data.attackConeAngle : style.coneAngle;
    ```
  - Use the resolved `range` / `coneAngle` for `spawnAttackEffect` and for
    spark/decal placement along the slash.
  - Keep the synchronous first-swing pattern: call the swing fn immediately when
    `swingCount` is 1; only use `scheduleAfter` for `i > 0` if multi-swing support
    is retained (mirror `renderSaberOfLight`).
  - Touch only `renderRustForgedSaber` and its style constant; do not alter other
    renderers, server files, or card stats.
- `game/client/test/cardRenderers.test.js`: add/update the geometry and timing
  cases described above in the Rust-Forged Saber describe block. Reuse `makeCtx`,
  `swingStyle`, and `renderCardUsed` helpers.

## Verification: code
