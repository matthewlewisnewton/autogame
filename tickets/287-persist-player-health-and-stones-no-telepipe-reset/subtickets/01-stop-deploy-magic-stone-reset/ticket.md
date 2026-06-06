# Stop deploy paths from resetting magic stones

Deploy and drop-in setup currently force `player.magicStones = STARTING_MAGIC_STONES` (49), wiping spent stones when a squad redeploys or a player drop-ins mid-run. Remove those resets so magic stones stay on the live player record; only brand-new player creation should seed `STARTING_MAGIC_STONES`.

## Acceptance Criteria

- `checkAllReady()` fresh-deploy loop no longer assigns `STARTING_MAGIC_STONES` to every player.
- `initializePlayerForActiveRun()` no longer overwrites `player.magicStones`.
- New players created via `buildPlayerRecord()` still receive `STARTING_MAGIC_STONES` on first join.
- Existing vitest cases that asserted deploy resets MS are updated to expect preservation (or are replaced with a preservation test).
- New unit test: player with `magicStones: 15` deploys via `checkAllReady()`, redeploys again after run ends — MS remains ~15 (regen may tick slightly during play).
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **`game/server/progression.js`** — delete `player.magicStones = STARTING_MAGIC_STONES` in the `checkAllReady()` deploy branch (~line 3196).
- **`game/server/index.js`** — delete `player.magicStones = STARTING_MAGIC_STONES` in `initializePlayerForActiveRun()` (~line 1037); keep `STARTING_MAGIC_STONES` in `buildPlayerRecord()` for first-time players (~line 920).
- **`game/server/test/server.test.js`** — update `fresh deploy after telepipe suspend and abandon resets magicStones` (or equivalent) to expect MS preservation per owner decision; add focused preservation test if needed.
- **`game/server/test/integration.test.js`** — update `resets slotCooldowns and magicStones on active-run reconnect` if it asserts MS reset on drop-in reconnect.

## Verification: code
