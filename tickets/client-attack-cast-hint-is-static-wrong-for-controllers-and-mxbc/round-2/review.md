## Runtime health

The captured run is healthy. `metrics.json` reports `"ok": true`, the client reached active gameplay with a canvas, connected socket state, visible hand, and no `pageerrors`. `console.log` contains only Vite connection and launch-booth messages; there are no `pageerror` or `[fatal]` entries from game code. The round-2 coverage run also completed with 50 test files and 512 tests passing.

## Acceptance criteria findings

### Hint text reflects active input device and live bindings

Keyboard/mouse mode preserves the intended copy, and standard gamepad mode uses the shared `getHandSlotInputHints()` binding path so default and remapped standard buttons can feed the hint text. The code also refreshes the hint from `renderHand()`, `onSettingsChange()`, and gamepad connect/disconnect handlers, so the visible text is not limited to page load.

There is still a blocking gap for the 8BitDo 64/controller-profile path. `getHandSlotInputHints()` resolves the active binding, but then the 8BitDo branch displays `EIGHTBITDO_64_SLOT_HINTS[action]` and `EIGHTBITDO_64_SLOT_HINT_LABELS[action]` before using the resolved binding description. That means custom/remapped `useSlotN` bindings are honored by `pollInput()`, but the slot badges and `getAttackCastHint()` keep showing the hardcoded A/B/C-button defaults. This violates the acceptance requirement that the hint reflect live bindings, including profile-specific gamepad labels.

### Hint auto-dismisses and persists per profile

The dismissal controller is well-scoped and satisfies the policy: it arms on hand show, fades after 10 seconds, dismisses after both a successful attack and a successful cast, and persists a per-profile localStorage flag keyed by the stored player id. Rejected `useCard()` attempts do not count toward dismissal. Focused tests cover timeout dismissal, attack-plus-cast dismissal, same-profile persistence, fresh-profile reappearance, and rejected action gating.

### Client test coverage

The added tests cover keyboard text, standard gamepad text, 8BitDo default text, auto profile switching on controller connection, and dismissal behavior. The missing test is the failing integration case above: remapped 8BitDo hand-slot bindings should change both the hand-slot labels and the attack/cast hint text.

## Design and foundation consistency

The change stays client-side and does not alter the server/client architecture, movement, rendering foundation, or combat simulation. The captured fallback smoke flow confirms the game still renders, connects, enters a run, shows the player hand, and accepts normal movement/key-item flow. No development debug scenario was added or changed for this ticket.

## Remaining gaps

1. 8BitDo 64 hand-slot remaps are not reflected in the hand badges or attack/cast hint. Input can use a remapped `useSlotN` binding, but `getHandSlotInputHints()` still returns hardcoded A/B/C labels for that profile, so `getAttackCastHint()` is stale after those binding changes.

VERDICT: FAIL
