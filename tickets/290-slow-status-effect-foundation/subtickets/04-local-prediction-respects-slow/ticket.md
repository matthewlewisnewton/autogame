# Local client movement prediction respects SLOW

The server already reduces the local player's authoritative speed by `slowFactor`
while slowed, but the client-side movement prediction still advances the local
player at full `MOVE_SPEED`. This makes a slowed local player render at full speed
and rubber-band back to the slower server position. Apply the active slow factor to
the local prediction step so the local player visibly moves at the reduced
multiplier for the full slow duration.

## Acceptance Criteria

- The client prediction loop in `game/client/renderer.js` multiplies the local
  player's per-tick move distance by the active slow factor whenever the local
  player is currently slowed (`slowedUntil` is in the future), instead of always
  using `MOVE_SPEED * TICK_DT`.
- The slow factor is read from the local player's broadcast snapshot
  (`gameStateRef.players[myIdRef].slowFactor` / `slowedUntil`); when not slowed or
  the fields are missing, prediction uses the full `MOVE_SPEED` (factor of 1) so
  unslowed movement is unchanged.
- The factor used for prediction matches the server-authoritative reduction so the
  predicted position tracks the server position (no rubber-band) while slowed.
- The local player's slow indicator ring stays aligned with the (now slower)
  predicted avatar position while slowed.
- Movement emitted to the server (the `CLIENT_TO_SERVER.MOVE` emit with `dx`/`dz`)
  is unchanged — only the predicted local distance is scaled; the server stays the
  authority on applying slow.
- Existing client tests continue to pass; no regression to normal (unslowed)
  prediction or reconciliation.

## Technical Specs

- `game/client/renderer.js`:
  - In the prediction update (the `while (moveAccumulator >= TICK_DT)` loop near
    line 1615), compute a local slow factor: read the local player snapshot via
    `gameStateRef.players[myIdRef]`; if it exists and `Date.now() < slowedUntil`,
    use its `slowFactor` (clamped to `(0, 1]`, default to the same default the
    server uses if absent), else `1`. Pass `MOVE_SPEED * TICK_DT * slowFactor` to
    `tryPlayerMove(...)` instead of `MOVE_SPEED * TICK_DT`.
  - Do NOT scale the `CLIENT_TO_SERVER.MOVE` emit (`dx`/`dz` remain unit-direction);
    the server already applies its own `slowFactor`.
  - Ensure the slow indicator ring for the local player follows the predicted
    `myX`/`myZ` (the slower predicted position) so the ring does not lag the avatar.
- Reconciliation in `game/client/main.js` should not need changes once prediction
  matches the server speed, but verify the idle/desync snap threshold (around line
  1311–1336) no longer fights a slowed player; adjust only if it still snaps a
  correctly-predicted slowed player.

## Verification: code
