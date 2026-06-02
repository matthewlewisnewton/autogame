# Review: Key Item - Phase Step

## Runtime health

Blocking failure. The captured round is not valid proof that the game starts and loads cleanly:

- `metrics.json` has `"ok": false` and `failure_kind: "capture_failed"`.
- `console.log` is missing from `round-4`.
- `screenshot.log` shows the capture crashed before browser automation: `ERR_MODULE_NOT_FOUND: Cannot find package 'playwright' imported from .../harness/screenshot.mjs`.
- `client.log` and `server.log` show Vite and the game server started, and there are no captured browser `pageerrors`, but no screenshots, scenarios, probes, or clean browser console were produced.

Per the ticket review rules, this alone requires `VERDICT: FAIL`.

## Acceptance criteria

- **Cooldown ~12s:** Met in code. `KEY_ITEM_DEFS.phase_step` defines `cooldownMs: 12000`, and the `useKeyItem` success path sets the caster cooldown from that definition. The dedicated test covers a second use returning `on_cooldown`.
- **Requires co-op ally in same run; solo fails gracefully:** Met in code. The server selects candidates from the current lobby/run state, excludes the caster, dead players, and extracted players, and returns `no_ally` without burning cooldown when none exists. The debug scenario no longer injects a fabricated ally.
- **No swap through walls / endpoints valid:** Met for the ticket's endpoint-validity requirement in code. Before swapping, the handler validates both current endpoints with `isInsideDungeon`, and it swaps `x`, `y`, and `z` only after range and endpoint checks pass.
- **Client target highlight or auto-nearest:** Met in code. The renderer recomputes the nearest living, non-extracted ally within 6m each frame while `phase_step` is equipped, displays a cyan ground ring, and `main.js` sends that highlighted `targetPlayerId`; when omitted or null, the server falls back to nearest-ally selection.
- **Tests: two players swap coords; out of range fails:** Met. `game/server/test/phase_step.test.js` covers definition values, nearest ally swapping, explicit target swapping, out-of-range failure without cooldown burn, solo failure, and cooldown enforcement. The round-4 coverage log reports `33 passed` test files and `933 passed` tests.

## Design and foundation consistency

The implementation fits the documented co-op dungeon loop and card/key-item combat model. It does not weaken the foundation requirements around server-client architecture or movement synchronization; the changed behavior is confined to the server `useKeyItem` path, key-item definitions, tests, and client-side targeting feedback.

## Debug scenario review

`phase-step-ready` remains gated by the existing `?debugScenario=...` URL flow and localhost/server debug checks. Normal gameplay does not enter it. The scenario now only equips and prepares the local caster; it does not create a synthetic ally, so a real co-op player is still required for an actual swap. The same end state is reachable through normal play by entering a co-op run, equipping `phase_step`, and standing within 6m of another live, non-extracted player.

## Remaining gaps

1. Round-4 capture did not complete, so there is no clean browser-load proof for this ticket. Restore the Playwright capture dependency and rerun the visual/runtime capture before this can pass.

No Phase Step code-level blocking gaps were found in the live code review.

VERDICT: FAIL
