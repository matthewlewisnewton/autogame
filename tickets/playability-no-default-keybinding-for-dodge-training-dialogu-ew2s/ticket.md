# playability: no default keybinding for Dodge — training dialogue tells player to 'dodge roll' but the dodge action has no key and is not bindable in Settings

## Difficulty: easy

## Goal

In game/client/input.js DEFAULT_KEYBOARD, the dodge action is bound to an EMPTY array: dodge: []. So a fresh player has NO key to perform the dodge-roll. There is a dodge_roll action wired through input.js (action 'dodge') and renderer.js (case 'dodge_roll'), and the training_caverns tier-1 room-1 dialogue beacon explicitly instructs: 'Watch enemy attack telegraphs — dodge roll when you see a wind-up before they connect.' But the player literally cannot dodge.

Additionally, dodge does not appear in the Settings UI (settings.js / index.html have no dodge rebind control — grep finds none), so a player cannot even bind a key to it themselves.

REPRO: cold-start -> hub -> deploy training_caverns t1. The intro/room-1 coaching references dodging; pressing any reasonable key (space, shift, ctrl) does nothing because no key maps to the dodge action. EXPECTED: a sensible default (e.g. Space or Shift) bound to dodge, and/or a rebindable control in Settings. ACTUAL: dodge is unreachable for a new player.

This compounds the first-level difficulty blocker (see related bead autogame-76x8): the game's own coaching tells you to dodge incoming hits, but the mechanic is unbound. Difficulty: easy (add a default key in DEFAULT_KEYBOARD and/or expose in settings).

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
