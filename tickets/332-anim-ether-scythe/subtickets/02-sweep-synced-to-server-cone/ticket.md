# Ether Scythe — sweep shape/range synced to the server effect

Drive the Ether Scythe's visible sweep from the server's actual hit geometry so
the ghostly arc covers exactly what the server resolves. The `cardUsed` payload
carries `attackConeAngle` (Math.PI / 180° for the scythe) and `attackRange`;
the current renderer hardcodes a 120° cone and a fixed range, so the visual
under-covers the real reach. Make this card's sweep read those server values,
keeping the swing a single immediate flourish (this card has no `windUpMs`, so
there is no 307 wind-up telegraph to play).

## Acceptance Criteria

- When the `cardUsed` payload includes a finite `attackConeAngle`, the scythe's
  `spawnAttackEffect` is called with `coneAngle` equal to that server value
  (Math.PI for `harvesting_scythe`), instead of the hardcoded style cone.
- When the payload includes a finite `attackRange`, the scythe's
  `spawnAttackEffect` is called with `range` equal to that server value, and the
  decal/wisp placement scales off the same range.
- This server-driven sync is opt-in per card (a style flag) and applies ONLY to
  `harvesting_scythe`; `iron_sword`, `flame_blade`, and `saber_of_light` keep
  rendering with their hardcoded style cone/range (regression-guarded by a test
  showing one of them ignores a payload `attackConeAngle`).
- When the payload omits `attackConeAngle`/`attackRange` (e.g. older/minion
  payloads), the scythe falls back to its style `coneAngle`/`range` and does not
  throw.
- The swing fires immediately on `cardUsed` (no wind-up/charge telegraph and no
  delay) for this card, matching the server resolving the hit on use.
- A client test asserts the scythe uses the payload's `attackConeAngle`/
  `attackRange`, the fallback path when they are absent, and that a sibling
  blade ignores the payload cone.

## Technical Specs

- `game/client/cardRenderers.js`:
  - In `renderWeaponSwing`, when the firing style opts in (e.g.
    `style.syncToServerCone: true`, set only on `harvesting_scythe`), prefer
    `data.attackConeAngle` / `data.attackRange` (when `Number.isFinite`) over
    `style.coneAngle` / `style.range` when building the `spawnAttackEffect`
    options, and use the resolved range for the decal/spark/wisp placement math
    (the `pointAlong(origin, direction, range * 0.6)` calls).
  - Add the `syncToServerCone` flag to the `harvesting_scythe` style entry only;
    leave the other three blade entries unchanged so they keep their authored
    cones.
  - Keep the swing synchronous — no `scheduleAfter`/wind-up branch for this card.
- `game/client/test/cardRenderers.test.js`: add assertions in the Ether Scythe
  area for the server-cone/range path, the omitted-field fallback, and a sibling
  blade (e.g. `flame_blade`) ignoring a payload `attackConeAngle`. Reuse
  `makeCtx` / `renderCardUsed` and the existing `swingStyle(ctx)` helper.

## Verification: code
