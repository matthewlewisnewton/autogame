# Senior Review — combat: dodge roll ignores wall collision (tunnels through level geometry)

## Runtime health

- `metrics.json`: `"ok": true`, `pageerrors: []`, no `harness_failure` block, servers
  started on `localhost:5178`.
- `console.log`: only Vite connect lines, a benign `409` resource (pre-existing,
  unrelated to this ticket), and normal scene init / ready-up logs. No `pageerror`
  or `[fatal]` lines.
- Capture probes show a real run: player readies, enters gameplay, moves (W/D),
  and dodges. After the dodge the player sits at `(x=-7.65, z=19)`, still inside
  the dungeon, with `keyItemCooldownRemaining` active and the cooldown HUD shown
  (`Dodge Roll … 0.4`). No tunnel through geometry observed.

The game runs and loads cleanly.

## Acceptance criterion

> Dodging while facing a wall leaves the player on the near side of the wall (no net
> displacement through geometry); a server test covers dodge into a wall segment;
> dodge along open floor still travels its full distance.

**Met.**

- **Wall collision on dodge displacement.** The `dodge_roll` branch in
  `game/server/keyItemEffects.js:547-584` resolves the dash direction, computes
  `dashDistance = MOVE_SPEED * 3 * (rollDistanceMs/1000)`, fetches
  `getWallColliders()`, and applies the move via
  `tryPlayerMove(player.x, player.z, dx, dz, dashDistance, colliders)`. It only
  commits the new position when `result.moved` is true. This is the same
  collision-aware path used for walking, satisfying the ticket's core fix.
- **No tunneling (the actual bug).** `tryPlayerMove` →
  `tryDisplacement` (`simulation.js:484`) runs `checkSweptCollision` over the full
  start→target segment (`simulation.js:500`), not merely an endpoint test. A
  7.2-unit dash therefore cannot jump across a thin wall into the next area — the
  exact `z=19 → z=5.2` tunnel from the repro. Axis-separated sliding is preserved
  for glancing hits.
- **Server test covers dodge into a wall segment.** `game/server/test/dodge_roll.test.js`
  adds: dash into east wall stops at the wall boundary (`5.3`); a full-distance
  (7.2u) dash into the east wall stops at the wall edge and never penetrates;
  players pinned flush against the east wall and the north wall return
  `moved:false` and do not advance into the wall. These use `buildWallColliders`
  on an explicit room layout and the real dodge distance formula
  (`dodgeDashDistance()`), exercising the same `tryPlayerMove` the handler uses.
- **Open floor still travels full distance.** The regression test
  `dodge roll on open floor travels full configured dash distance (7.2 units)`
  asserts displacement ≈ 7.2 and the landing point is `isInsideDungeon`. A second
  direction test confirms input-direction and rotation-fallback dashes both reach
  the full distance.

All 11 tests in `dodge_roll.test.js` pass. All exports the test imports from
`index.js` resolve at runtime.

## Design / regression consistency

- The change is test-only over already-correct handler code; it adds no new
  surface and does not alter movement, collision, or net-replication behavior.
  The dodge path now provably honors the same wall-collision foundation as
  walking, consistent with `requirements.md`.
- No debug scenarios added or changed by this ticket.

## Code quality

- No new game-code edits in the diff (`git diff` shows only test + sub-ticket
  files). No dead code, no console errors introduced.

## Remaining gaps

None blocking. The acceptance criterion is fully and robustly met, and the
captured run is healthy.

VERDICT: PASS