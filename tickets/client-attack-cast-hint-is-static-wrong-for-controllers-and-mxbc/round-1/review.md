## Per-Criterion Findings

### Runtime Health
PASS. The captured run loaded cleanly: `metrics.json` has `"ok": true`, no `harness_failure`, and `pageerrors` is empty. `console.log` contains Vite connection lines, non-fatal 409 resource errors, and scene/lobby logs, but no `pageerror` or `[fatal]` entries from game code. Client and server logs show the dev server, game server, socket connections, lobby transition, and shutdown completed normally. The screenshot files referenced by `metrics.json` were not present in the round directory, so I could not inspect the PNGs directly; the recorded probes still show the game in `playing` with canvas, card hand, movement, and key-item HUD state.

### Hint Text Reflects Active Input Device and Bindings
PASS. `game/client/input.js` now builds `getAttackCastHint()` from `getHandSlotInputHints()`, preserving the keyboard/mouse copy and producing controller-specific text such as standard `A-RB` and 8BitDo 64 `A-C right`. `game/client/main.js` applies this text on hand render, settings changes, and gamepad connect/disconnect, so the visible HUD tracks active input mode and binding refreshes through the existing hand-slot hint path. The new `game/client/test/attack-cast-hint.test.js` covers keyboard, standard gamepad, 8BitDo 64 labels, and auto-profile gamepad connection.

### Hint Auto-Dismissal and Persistence
FAIL. The timeout and per-profile localStorage persistence are well factored in `game/client/attackHintDismiss.js`, and the helper tests cover timeout dismissal, same-profile persistence, and fresh-profile reappearance. However, the action-based dismissal is not tied to successful gameplay actions. `main.js` calls `attackHintDismisser.noteProgress({ casted: true })` immediately after card slot click/input even when `useCard()` returns early for an empty slot, cooldown, active minion, insufficient stones, hand full, or other local rejection. The gamepad path similarly records slot 0 as an attack based only on the raw input slot, before confirming a successful weapon/basic attack. This can permanently mark the profile as having seen the hint after an unsuccessful card attempt plus any later attack, violating the ticket's policy of dismissing after the first successful attack and card cast.

### Tests and Coverage
PASS with the blocking behavior gap above. The recorded vitest run passed: 49 test files and 506 tests. The new tests cover the pure text builder and dismissal state machine, but there is no integration test proving `main.js` only records dismissal progress after `useCard()` actually accepts/emits a card use.

### Design and Requirements Consistency
PASS. The change remains client-side HUD/input affordance work and does not alter the multiplayer loop, card combat model, server-client architecture, movement sync, dungeon design, or persistence systems described in `game/docs/design.md` and `game/docs/requirements.md`.

### Debug Scenarios
PASS. This ticket did not add or change a `?debugScenario=` shortcut. The captured metrics show `debugScenario: null`, and the changed files are limited to the client hint/input/UI/tests.

## Remaining gaps

1. Action-based hint dismissal is triggered by input attempts instead of successful attack/cast outcomes, so the hint can persistently disappear before the player has completed a real card cast.
   Files: `game/client/main.js`, `game/client/attackHintDismiss.js`, `game/client/test/attack-hint-dismiss.test.js`, `game/client/test/attack-cast-hint.test.js`
   Fix: Make card/attack handlers record dismissal progress only after `useCard()` accepts/emits a valid action or after an authoritative success signal, and add client tests for empty/unusable slot attempts not dismissing the hint.

VERDICT: FAIL
