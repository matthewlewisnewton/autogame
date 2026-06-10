# Client: attack/cast hint is static — wrong for controllers and shown forever

## Difficulty: medium

## Goal

The center gameplay hint (game/client/index.html:88, #attack-hint: 'Click to attack - press 1-6 to cast cards') is a hardcoded string. Two problems. (1) Device-blind: the card SLOT badges are already controller-aware via getHandSlotInputHints (game/client/input.js:418-440, including the 8bitdo-64 C-button path) and the hand toggles input-hints-gamepad classes (game/client/main.js:2747), but the hint line never updates — a gamepad player reads 'Click' and '1-6', both wrong for their device. Build the hint text from the same binding-resolution machinery: attack verb per device (click vs the bound button) and the slot range per active input mode, updating when the gamepad connects/disconnects or bindings change. (2) Never dismissed: setAttackAffordanceVisible(true) runs in showCardHand on every run start and only hides with the hand (main.js:243-246,276,282) — no fade, no seen-before memory. Add a dismissal policy: fade after ~10s or after the first successful attack AND card cast, persisted (e.g. localStorage) so veterans are not nagged every run; reappear on fresh profiles. Coordinate with autogame-e0sw (key item binding in the same hint line). Found 2026-06-09.

## Acceptance Criteria

- Hint text reflects the active input device (keyboard/mouse vs gamepad incl. profile-specific labels) and live bindings; it auto-dismisses per the chosen policy and stays dismissed across runs for the same profile; reappears for new profiles; client tests cover keyboard text, gamepad text, and dismissal

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
