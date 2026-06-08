## Runtime health

The round-4 captured run is healthy. `metrics.json` has `"ok": true`, no `harness_failure`, and an empty `pageerrors` array. `console.log` contains only Vite connection messages, two 409 resource-load entries from the auth/setup flow, and normal game logs; it has no `pageerror` or `[fatal]` entries from game code. `server.log` and `client.log` show the dev servers started, gameplay reached `phase: "playing"`, and shutdown noise is limited to the explicitly benign Vite `EPIPE` socket-close case.

The smoke capture exercised auth, lobby create/join, ready transition, movement, and key-item cooldown. It was not a dedicated wind-up scenario, but it proves the ticket branch loads and runs cleanly without regressing the foundation requirements for 3D rendering, websocket connection, multiplayer presence, and movement synchronization.

## Acceptance criteria

### A card with `windUpMs` locks movement and other card usage for the duration, then resolves

Satisfied. `game/shared/cardStats.json` defines `windUpMs` on heavy/committed cards including `magma_greatsword`, `steel_claymore`, `glacier_collapse`, `dungeon_drake`, and `spike_trap`. On use, `game/server/cardEffects.js` commits the player into `cardUseState: "windup"`, stores a `pendingCardUse`, pays costs/cooldowns at commit, locks origin/rotation, and emits state without applying the card effect.

The server lock is authoritative. `game/server/socketHandlers/runHandlers.js` rejects movement and discard while `isPlayerCardCommitted()` is true; `game/server/cardEffects.js` rejects additional `useCard`; and `game/server/keyItemEffects.js` rejects key items during commitment. `game/server/simulation.js` also skips movement during commitment, processes pending wind-ups on the authoritative tick, and keeps the player committed while `pendingCardUse` still exists, so input remains locked until the queued effect actually resolves. If the player dies/extracts before resolution, the pending card commitment is cleared instead of firing late.

Deferred resolution is implemented in `processPendingCardWindups()` and `resolvePendingCardUse()`. It uses the locked origin and rotation rather than live player position, which matches the “committed power hit” design and prevents moving the strike during the wind-up.

### Normal cards without `windUpMs` remain instant and unaffected

Satisfied. The wind-up branch only activates when `cardDef.windUpMs > 0`; cards with no `windUpMs`, such as `iron_sword`, `frost_nova`, and `skeleton_knight`, continue through the existing immediate effect paths. The regression tests verify instant damage/spawns, no commitment state, and continued movement after instant card use.

### Client shows wind-up animation and input-lock feedback

Satisfied. The server snapshots expose `cardUseState`, `cardWindupUntil`, and `cardWindupCardId`. The client uses those fields to block card-slot input, discard, key-item input, movement packets, and rotation-only movement packets while committed. The hand UI toggles `#card-hand.input-locked`, dimming and disabling card slots, and the renderer shows a sky-blue player wind-up ring plus emissive avatar flash while `cardUseState === "windup"`.

### Server tests cover input-lock, deferred resolution, normal-card regression, and card types

Satisfied. `coverage.log` reports all tests passing: 137 test files and 2179 tests. The added wind-up tests cover state snapshot fields, movement/card/key-item/discard rejection, lock persistence until pending resolution, deferred weapon damage, cancellation on death, telepipe suspend cleanup, no-regression instant cards, and wind-up behavior for spell, creature, and enchantment card types. Coverage visibility includes the changed client/server files, with no threshold failures.

## Design and requirements consistency

The implementation is consistent with `game/docs/design.md`: it keeps combat card-based, adds a risk/reward commitment window for heavy cards, mirrors the existing enemy wind-up style, and leaves the lobby/dungeon loop intact. It does not regress `game/docs/requirements.md`: the captured run renders a Three.js scene, connects frontend to backend via websocket, shows two players in a squad/run, and movement input updates state during normal play.

## Debug scenarios

This ticket adds `magma-windup-ready`. It remains behind the existing debug-scenario path and is requested only through the `debugScenario` socket/URL mechanism on localhost; normal gameplay does not enter it. The scenario places `magma_greatsword` in hand with a nearby enemy for QA, but the same end state is reachable normally by evolving `flame_blade` into `magma_greatsword` and entering a run. It does not bypass the production card-use or server validation path: tests still emit normal `useCard` and rely on the same wind-up, lockout, and deferred-resolution code used by real play.

## Remaining gaps

None.

VERDICT: PASS
