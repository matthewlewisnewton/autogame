# Align updateMinions loot mock with LOOT_SPAWN_CHANCE

The `updateMinions() > spawns loot for dead enemies and removes them` integration test hardcodes `Math.random` to `0.1` for forcing loot spawns, while the dedicated `spawnLoot` describe block already uses `config.LOOT_SPAWN_CHANCE`. If the config constant ever drops below `0.1`, this test could silently fail while unit tests pass.

## Acceptance Criteria

- `game/server/test/server.test.js` — the `updateMinions` test mock for `Math.random` uses `config.LOOT_SPAWN_CHANCE - 0.1` (or equivalent expression referencing the constant) instead of the hardcoded `0.1`.
- The comment above the mock references `LOOT_SPAWN_CHANCE`, not a magic number.
- No other changes to the test file or any other file.

## Technical Specs

- **File:** `game/server/test/server.test.js` (around line 630)
- Change the `Math.random` mock value from `0.1` to `config.LOOT_SPAWN_CHANCE - 0.1`
- Update the accompanying comment to reference `LOOT_SPAWN_CHANCE`
- No other changes; do not touch any other files.

## Verification: code
