## Runtime health

The captured round-2 run loads cleanly. `metrics.json` reports `"ok": true`, the servers started, `pageerrors` is empty, and `console.log` has no `pageerror` or `[fatal]` entries from game code. The remaining console noise is non-fatal capture/auth conflict noise and benign dev-server shutdown output.

## Acceptance criteria

### A card with `windUpMs` locks movement and other card usage, then resolves

Partially met, with one blocking gap. The server now creates `cardUseState: "windup"`, stores `pendingCardUse`, locks commit origin/facing, blocks `move` packets and `useCard`, and resolves the pending card at the end of the wind-up. Tests cover movement blocking, duplicate card blocking, delayed `CARD_USED`, locked-origin resolution, death cancellation, and lock persistence until resolution.

However, the commitment does not lock key-item actions. `game/server/keyItemEffects.js` has no `isPlayerCardCommitted()` guard, and `game/server/socketHandlers/keyItemHandlers.js` forwards every `useKeyItem` event straight into the key-item dispatcher. That lets a player use `dodge_roll`, `phase_step`, `guard_block`, or other key items during a card wind-up, including the exact dodge escape the ticket calls out as forbidden. The client also only checks `gamePhase` before emitting `useKeyItem`, so the UI/input path does not participate in the lockout.

### Normal cards with no `windUpMs` remain instant

Met. `iron_sword`, `frost_nova`, and `skeleton_knight` are covered by regression tests and continue resolving without commitment. The live code only enters `tryBeginCardWindup()` when `cardDef.windUpMs > 0`.

### Client shows wind-up animation and lock feedback

Partially met. The local hand is disabled while `cardUseState === "windup"`, movement prediction stops emitting `move`, and the renderer adds player wind-up markers/flashing from snapshot fields. This covers card/movement feedback, but the lock feedback is incomplete for key items because committed players can still trigger the key-item binding and the server accepts it.

### Server tests cover input-lock, resolution, and no normal-card regression

Mostly met. The round-2 coverage run passed: 137 test files, 2174 tests. New wind-up tests cover server state, deferred resolution, card types, backward compatibility, and client hand/movement lock behavior. The missing blocking test coverage is a committed `useKeyItem`/`dodge_roll` rejection path.

## Design and requirements consistency

The implementation is consistent with the card-combat design and does not regress the foundation requirements for rendering, client/server connection, multiplayer visualization, or movement synchronization. The blocking issue is design-level: the ticket explicitly requires committed players to be vulnerable and unable to move/dodge, but key-item dodge remains available.

## Debug scenarios

The new `magma-windup-ready` scenario is debug-only: the client requests debug scenarios from the localhost `?debugScenario=` URL path, and the server gates debug scenario use with the existing debug/localhost checks. Its state is reachable through normal gameplay by evolving `flame_blade` into `magma_greatsword`; the shortcut does not replace or weaken the normal evolution/card-use flow.

## Remaining gaps

1. Wind-up commitment does not block key-item/dodge activation. A player can start a `windUpMs` card and still use `dodge_roll` or other key items before the delayed card resolves, breaking the ticket's committed/vulnerable risk-reward requirement.

VERDICT: FAIL
