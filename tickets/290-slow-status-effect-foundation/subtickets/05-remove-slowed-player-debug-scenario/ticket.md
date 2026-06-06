# Remove the unreachable `slowed-player` debug scenario

The `?debugScenario=slowed-player` shortcut puts the local player into an active
SLOW state that no normal gameplay path can currently reach — the only non-test
caller of `applySlow` is that debug branch itself. The real slow sources (ice
enemy #293, ice card #294) are separate future tickets, so for this foundation
ticket the debug shortcut must be withdrawn rather than left able to "pass" a
state a real player cannot produce. Remove the scenario and its now-dead helper
import; leave the SLOW helpers, movement integration, indicator, and prediction
(already verified) untouched.

## Acceptance Criteria

- The string `'slowed-player'` is no longer present in the `DEBUG_SCENARIOS` set
  in `game/server/index.js`.
- The `else if (name === 'slowed-player')` branch (and its comment block) is
  removed from `applyDebugScenario` in `game/server/debugScenarios.js`.
- The `applySlow` import in the `require('./simulation')` destructure at the top
  of `game/server/debugScenarios.js` is removed, since that branch was its only
  consumer in this file (the simulation export and the `index.js` re-export of
  `applySlow` for future ice tickets MUST remain).
- A full-repo search (excluding `game/coverage/`, `tickets/`, and `test` files)
  for `slowed-player` returns no matches in shipped `game/` code.
- The SLOW foundation itself is unchanged: `applySlow`/`isSlowed` in
  `game/server/simulation.js`, the player/enemy movement scaling, the client
  slow indicator, and the local-prediction scaling are NOT modified.
- The existing server and client slow tests
  (`game/server/test/slow_status.test.js`,
  `game/client/test/local-slow-prediction.test.js`) still pass unchanged, and
  the server boots without an unused-binding/runtime error from the removed
  import.

## Technical Specs

- `game/server/index.js`: delete the `'slowed-player',` line from the
  `DEBUG_SCENARIOS = new Set([...])` literal (around line 470). Do not touch the
  `applySlow` import (~line 182) or its re-export (~line 1621) — those expose the
  helper for the future ice enemy/card and must stay.
- `game/server/debugScenarios.js`: delete the entire
  `} else if (name === 'slowed-player') { ... }` branch (around lines 1344–1354,
  including the leading comment) inside `applyDebugScenario`. Then remove
  `applySlow,` from the destructured `require('./simulation')` import near the
  top of the file (around line 28), as it is no longer referenced anywhere in
  this module.
- Do NOT add a replacement debug scenario and do NOT introduce a new
  slow-applying card/enemy here — that belongs to tickets #293/#294.

## Verification: code
