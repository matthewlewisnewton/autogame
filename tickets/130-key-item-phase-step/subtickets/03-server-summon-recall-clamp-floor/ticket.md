# Server: keep summon_recall minions ≥1m from the caster after clamping

The `summon_recall` minion-repositioning fallback can place a minion closer than
1m to the caster: the spiral search starts at `r = 1`, then `clampToDungeon()`
pulls the accepted point inward when the player hugs a wall, so the final
distance drops below the floor. This intermittently fails
`key-items.test.js > useKeyItem — summon_recall > clamps minion positions away
from walls…` (`expected 0.991… >= 1`), which reds the whole local-checks gate.
Make the fallback always settle a minion at least the ring-floor distance away.

## Acceptance Criteria

- After `summon_recall` repositions a minion, the minion's final distance from the
  caster is always `>= 1m` (and `<= 7m`), even when the caster is pressed against
  a wall and the ideal ring position must be clamped/spiraled.
- The spiral / nearby-spawn fallback no longer *accepts* a candidate whose
  post-clamp distance from the caster is below the minimum: a clamped point that
  lands too close to the player is rejected and the search continues outward
  instead of being committed.
- All other `summon_recall` behaviour is unchanged: minions still move away from
  their original spot (`> 1m` of travel), stay inside the dungeon, and are never
  placed in a wall-blocked position (`isEntityPositionBlocked` stays `false`).
- No other key item branch is changed; only the `summon_recall` positioning logic
  in `index.js` is touched.
- `game/server/test/key-items.test.js` passes deterministically — run the
  `summon_recall` "clamps minion positions away from walls" test repeatedly (it
  uses the unseeded procedural layout) and it passes every time. `pnpm test`
  (server) passes with no regressions; local-checks return `rc: 0`.

## Technical Specs

- `game/server/index.js`, `socket.on('useKeyItem', …)` `summon_recall` branch
  (the minion loop ~lines 2749–2797):
  - Define an explicit minimum-separation floor (e.g. `const minDist = 1;` —
    matching the test's `>= 1` assertion; the ring radius is ~2m so this is a
    safe lower bound).
  - In the spiral fallback (`for (let r = 1; r <= 6 …)`, ~line 2772) only accept a
    candidate `sc` when, in addition to the existing
    `!isEntityPositionBlocked(sc.x, sc.z, ENTITY_RADIUS) && isInsideDungeon(sc.x, sc.z)`
    checks, its post-clamp distance from the caster
    `Math.hypot(sc.x - player.x, sc.z - player.z) >= minDist`. Because clamping can
    pull a point inward, start/step the spiral so it keeps probing outward until a
    valid AND far-enough spot is found (e.g. begin at `r = minDist` and continue to
    the existing `r <= 6` bound).
  - Apply the same `>= minDist` guard to the `nearbySpawnPosition` result
    (~lines 2762–2766) so an early-accepted nearby point that ends up too close is
    not committed without the spiral getting a chance to find a farther one.
  - Do not weaken the existing wall-collision / inside-dungeon checks; the fix only
    *adds* the distance-floor condition to candidate acceptance.
- `game/server/test/key-items.test.js`: the existing summon_recall test is the
  oracle — do not change its assertions. (If a deterministic regression test for
  the wall-hugging case is helpful, it may be added in the same file, but the
  primary requirement is that the existing test stops flaking.)

## Verification: code
