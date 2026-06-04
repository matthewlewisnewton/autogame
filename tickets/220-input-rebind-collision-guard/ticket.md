# 220-input-rebind-collision-guard

## Difficulty: easy

## Goal

The settings UI binds useKeyItem to any key (game/client/main.js:3646-3657) with no collision check against fixed bindings (1-6/wasd/v/z). onKeyDown iterates DEFAULT_KEYBOARD in object order and returns on first match with useKeyItem LAST (input.js:90-118), so binding useKeyItem to '1' makes useSlot0 win and useKeyItem silently never fires (bind to 'w' and it's dead while movement still works) — no feedback.

## Acceptance Criteria

- 1. In the key-capture handler reject keys already used by a built-in action (compare against DEFAULT_KEYBOARD values, exposed via input.js getReservedKeys()), surfacing the existing toast. 2. No behavior change for valid binds.

## Verification

CORRECTNESS, self-contained. Low risk.
