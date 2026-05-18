# Server: Health, Damage, Death & Respawn

Add authoritative health tracking, a damage helper, death state, and an automatic 3-second respawn timer to the server. Every player's `hp` and `dead` flag must be included in the periodic `stateUpdate` broadcast.

## Acceptance Criteria
- Each player object gains a `dead` boolean (default `false`)
- A `damagePlayer(playerId, amount)` function exists that:
  - subtracts `amount` from the player's `hp`, clamping to a minimum of 0
  - sets `dead` to `true` when `hp` reaches 0
  - starts a 3-second respawn timer
- On respawn, the player's `hp` resets to 100, `dead` resets to `false`, and position resets to `(0, 0.5, 0)`
- `stateUpdate` payloads include `hp` and `dead` for every player
- Dead players are blocked from processing `move` events
- A `damage` socket event handler is exposed for testing (accepts `{targetId, amount}`)

## Technical Specs
- **File**: `game/server/index.js`
- Add `dead: false` to the player object created on connection
- Add `damagePlayer(playerId, amount)` helper; use `setTimeout` for the 3-second respawn
- In the `move` handler, guard: `if (player.dead) return`
- Add `socket.on('damage', ...)` test hook that calls `damagePlayer`
- `stateUpdate` already emits `gameState` (which contains `players`), so `hp` and `dead` flow through automatically once added to the player object

## Verification: code
