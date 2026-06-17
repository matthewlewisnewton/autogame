# Isolate fire-telepipe-ready harness deploy from live combat during suspend

## Description

The `fire-telepipe-ready` debug scenario spawns live `ember_descent` enemies alongside a dummy target but does not enable the wave-suppression / godmode path that `frost-crossing-telepipe-ready` already uses. During `suspendViaTelepipe`, the harness walks for up to 30s with live fire enemies and can flip `runStatus` to `'failed'` from player death before extraction completes. Mirror the frost telepipe harness isolation for fire and keep godmode enabled through the suspend step.

## Acceptance Criteria

- Deploying via `fire-telepipe-ready` leaves exactly one stationary dummy grunt in `_gameState.enemies` (no live `ember_wraith` / scripted-wave spawns), with scripted wave state cleared when applicable.
- On `fire-telepipe-ready` deploy, the solo player has `debugGodmode === true` on the server so burn and melee cannot kill them during `depleteRunResources` and `suspendViaTelepipe`.
- `suspendViaTelepipe` calls `enableGodmode(page)` before placing the portal so godmode stays on even if a prior full-playthrough step toggled it off.
- After depletion and telepipe placement, a solo fire telepipe harness run reaches hub lobby with `runStatus === 'suspended'` (or `suspendedRunSummary` populated) — not `'failed'`.
- `frost-crossing-telepipe-ready` behavior is unchanged.

## Technical Specs

- **Edit:** `game/server/debugScenarios.js`
  - In `syncDebugHooksForScenario`, add `hooks.suppressWavesAfterDeploy = true` to the `fire-telepipe-ready` block (currently only sets `telepipeHand`, `pinMsOnDeploy`, `pinMsOnTelepipePlace`, `spawnTelepipeDummy`). The existing `suppressWavesAfterDeploy` branch in `checkAllReadyInner` (~L3979) already replaces enemies with a single dummy, clears scripted waves, and sets `player.debugGodmode = true`.
  - Remove redundant `spawnTelepipeDummy` from fire if `suppressWavesAfterDeploy` subsumes it (frost-crossing keeps both today; prefer matching frost's working pattern).
- **Edit:** `harness/validate/lib/telepipe.mjs`
  - At the start of `suspendViaTelepipe(page)`, call `enableGodmode(page)` (already imported from `./combat.mjs`) before reading the hand and pressing the telepipe slot.

## Verification: code
