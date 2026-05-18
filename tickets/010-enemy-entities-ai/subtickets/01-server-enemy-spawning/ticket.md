# Server Enemy Spawning

On server start (or when the first player connects), spawn ~5 enemy entities into `gameState.enemies`. Each enemy gets a unique id, random spawn position within the world bounds, starting `hp`, and a default `state` of `'idle'`.

## Acceptance Criteria
- `gameState.enemies` is populated with exactly 5 enemy objects on server start
- Each enemy object has the shape `{ id, x, z, hp, state }` where `id` is unique, `x`/`z` are within `[-25, 25]`, `hp` is a positive number, and `state` is the string `'idle'`
- Enemies are included in the `stateUpdate` broadcast so every connected client receives them
- Enemies are also included in the `'init'` payload sent to newly connecting clients

## Technical Specs
- **File**: `game/server/index.js`
- Add a `spawnEnemies()` function that creates 5 enemies with `crypto.randomUUID()` (or an incrementing counter) for `id`, random `x`/`z` in `[-20, 20]`, `hp: 50`, `state: 'idle'`, and pushes them to `gameState.enemies`
- Call `spawnEnemies()` once inside `server.listen` callback (after server is ready)
- No new Socket.IO events are needed — enemies flow through the existing `stateUpdate` and `init` paths

## Verification: code
