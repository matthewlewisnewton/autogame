# Final Review: Client Attack/Cast Hint

## Per-Criterion Findings

### Runtime Health

PASS. The round-3 capture proves the game starts and loads cleanly with this ticket applied. `metrics.json` reports `ok: true`, includes gameplay probes with `phase: "playing"`, `sceneInitialized: true`, and `hasCanvas: true`, and has an empty `pageerrors` array. `console.log` contains only Vite connection messages, scene initialization, and launch-booth logs; there are no `pageerror` or `[fatal]` entries from game code.

### Device-Aware Hint Text

PASS. `game/client/input.js` now exposes `getAttackCastHint()`, built from `getHandSlotInputHints()`, so keyboard/mouse keeps the prior "Click to attack" / "1-6" wording while gamepad profiles use resolved hand-slot labels instead of hardcoded keyboard text. The implementation covers standard gamepad labels, 8BitDo 64 C-button labels, and remapped 8BitDo 64 button/C-button slot labels. `game/client/main.js` applies the builder when the hand/hint is shown, when the hand rerenders, when settings change, and when gamepads connect or disconnect.

### Dismissal Policy and Persistence

PASS. `game/client/attackHintDismiss.js` implements a guarded, testable controller that shows the hint only for profiles without a stored `attackHintSeen:<playerId>` flag, auto-dismisses after 10 seconds, and marks the profile seen when dismissed. The reticle remains separately controlled by the existing hand visibility path, so only the hint text fades/hides.

### Successful-Action Gating

PASS. `useCard()` now returns a boolean success signal and all dismissal progress paths are gated on that signal. Empty slots, unusable cards, active minions, full-hand draw cards, insufficient magic stones, and no-slot basic attacks do not count toward the persisted "seen" state. Keyboard/mouse canvas attack, hand-slot clicks, and gamepad slot activations only advance dismissal after a real emitted `USE_CARD` action.

### Fresh Profiles and Same-Profile Memory

PASS. The localStorage key is scoped by stored player id, so a profile that has seen the hint keeps it hidden on later runs while a different/new profile with no matching flag sees it again. Storage and timer access are guarded to avoid breaking gameplay if localStorage is unavailable.

### Design and Requirements Consistency

PASS. The change is limited to client HUD/input affordance behavior and does not alter the documented lobby/dungeon/card-combat loop, server-client architecture, multiplayer state, movement synchronization, combat simulation, or progression systems. The captured run still demonstrates auth/lobby entry, deploy into gameplay, movement, card hand visibility, and HUD state.

### Debug Scenarios

PASS. This ticket did not add or change any `?debugScenario=...` shortcut. No debug-scenario capture was used in `metrics.json`, and the normal lobby-to-gameplay path remains the exercised route.

### Test and Coverage Evidence

PASS. The round-3 coverage log shows the client suite ran successfully, including the new `attack-cast-hint`, `attack-hint-dismiss`, `attack-hint-dismiss-action`, and expanded `input` coverage. The tests cover keyboard text, standard gamepad text, 8BitDo 64 text, remapped 8BitDo 64 labels, timeout dismissal, attack-plus-cast dismissal, persistence across runs, fresh-profile reappearance, and rejected-action gating.

## Remaining gaps

None.

VERDICT: PASS
