# Client: consume deltas in the live receive path

## Difficulty: medium
## Verification: visual
## Depends on: 154-06-client-apply-delta, 154-07-server-broadcast-wiring

## Goal
Switch the live `stateUpdate` handler to apply keyframes/deltas via
`applyStateDelta`, feeding the renderer from the maintained mirror — so the
game plays identically to the pre-delta full-snapshot version.

## Acceptance Criteria
- The client handler applies keyframe (replace) and delta (merge/remove)
  messages and the renderer reads the resulting mirror.
- Visual parity with today: players, enemies, minions, loot, HP, decks, and
  cooldowns all render and update correctly over a normal play session.
- No crashes/console errors across connect → play → reconnect.

## Technical Specs
- `game/client/main.js` (the `stateUpdate` socket handler) + the renderer's
  state source; uses `game/client/stateApply.js`.

## Verification: visual
- Play a normal session (lobby → dungeon → combat): movement, enemies, loot,
  and HUD behave exactly as before. `pnpm test:quick` green.
