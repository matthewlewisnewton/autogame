# Device-aware, live-binding attack/cast hint text

Replace the hardcoded `#attack-hint` string ("Click to attack · press 1–6 to cast cards") with text built from the same binding-resolution machinery the hand slot badges use, so a gamepad player sees their real attack verb and slot range. The text must rebuild when a gamepad connects/disconnects or bindings change.

## Acceptance Criteria

- A pure, exported builder function (e.g. `getAttackCastHint()` in `game/client/input.js`) returns the hint text for the **active input mode**, with no DOM dependency.
- In **keyboard/mouse** mode the text reads as today: a "Click to attack" attack verb plus the slot range "1–6" (cast cards), matching the prior copy.
- In **gamepad** mode the text uses resolved bindings, NOT the literal "Click" / "1–6":
  - the attack verb reflects the gamepad attack input (resolved via the existing binding machinery — `getBindingForAction` / `getHandSlotInputHints` and the standard vs `8bitdo-64` button-label paths), and
  - the cast portion reflects the actual hand-slot buttons for the active profile (first–last usable slot button labels via `getHandSlotInputHints()`, including the `8bitdo-64` C-button labels).
- `main.js` sets `attackHintEl.textContent` from the builder wherever the hint is shown (`showCardHand` / `setAttackAffordanceVisible(true)`) instead of relying on the static HTML, and re-applies it on `gamepadconnected` / `gamepaddisconnected` (existing listeners ~main.js:4766–4781) and whenever the hand re-renders (`renderHand`).
- The static fallback text in `index.html` remains present but is overwritten at runtime (no flash of wrong device text once a gamepad is active).
- Client tests cover: keyboard hint text, standard-gamepad hint text, and `8bitdo-64`-gamepad hint text (asserting the C-button / face-button labels appear and "Click"/"1–6" do NOT appear in gamepad mode).

## Technical Specs

- `game/client/input.js`: add `getAttackCastHint()` (or similarly named) returning `{ mode: 'keyboard' | 'gamepad', text: string }`. Reuse `isGamepadInputHintsActive()`, `getPrimaryGamepad()`, `getActiveProfile()`, `getBindingForAction()`, `getHandSlotInputHints()`, and the `STANDARD_BUTTON_HINTS` / `EIGHTBITDO_64_PROFILE.buttonLabels` resolution already used by `getUseKeyItemBinding()` (input.js:463–484) and `getHandSlotInputHints()` (input.js:418–447). Derive the cast slot range from the first and last hand-slot hint labels rather than hardcoding "1–6".
- `game/client/main.js`: import the new builder; add a helper (e.g. `applyAttackHintText()`) that writes `attackHintEl.textContent`; call it from `setAttackAffordanceVisible(true)` / `showCardHand` (main.js:254–289), from `renderHand` (main.js:2807+, near the existing `getHandSlotInputHints()` call at 2814), and from the `gamepadconnected` / `gamepaddisconnected` handlers (main.js:4766–4781).
- `game/client/index.html:95`: leave the existing string as a fallback; it will be overwritten by `applyAttackHintText()`.
- Add a client test file under `game/client/test/` (e.g. `attack-cast-hint.test.js`) exercising the builder across keyboard, standard gamepad, and `8bitdo-64` profiles (follow the gamepad-mocking pattern in `client/test/input.test.js` / `client/test/gamepad-profiles.test.js`).
- Do NOT implement dismissal/fade here — that is sub-ticket 02. This ticket only changes WHAT text is shown, not WHEN it hides.

## Verification: code
