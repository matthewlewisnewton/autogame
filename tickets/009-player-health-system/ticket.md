# Player Health & Respawn

Players have hit points that can be reduced, depleted, and restored. When a
player dies they respawn. This is the foundation the combat tickets build on.

## Acceptance Criteria
- Each player has an `hp` value (max 100) tracked authoritatively on the server
- An HP bar is shown in the client HUD and updates in real time
- When a player's `hp` reaches 0 they enter a `dead` state — their cube is
  visually distinct (hidden or greyed out) and they cannot move
- Dead players respawn at the world origin with full `hp` after 3 seconds
- Every player's `hp` and `dead` state is broadcast so all clients see it

## Technical Specs
- **Files**: `game/server/index.js`, `game/client/main.js`,
  `game/client/index.html`, `game/client/style.css`
- **Server**: `hp` already exists on the player object — add a `dead` boolean,
  a `damagePlayer(id, amount)` helper, and a respawn timer. Include `hp`/`dead`
  in `stateUpdate`.
- **Client**: render an HP bar HUD element; reflect remote players' `dead`
  state on their meshes. A `damage` test hook is acceptable until real combat
  exists (tickets 012–014).
