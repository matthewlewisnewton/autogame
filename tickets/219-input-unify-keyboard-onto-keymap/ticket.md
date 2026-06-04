# 219-input-unify-keyboard-onto-keymap

## Difficulty: medium

## Goal

Two independent client input systems read the same hardware: input.js owns keyState+WASD listeners+getMovementDirection+readMoveStick (game/client/input.js:62-209), and renderer.js owns a SECOND keys map+keydown/keyup+getKeyboardMovement (game/client/renderer.js:145,692-731,1214-1233). Only the renderer path drives movement; input.js's movement half is dead in prod (tested only). Lock-on is a hardcoded magic 'z' in renderer's keydown (L1217), outside input.js's ACTIONS/DEFAULT_KEYBOARD table, re-implementing its own repeat/phase guard. setGamepadInputHandler is registered with an empty callback (main.js:2974) — dead plumbing.

## Acceptance Criteria

- 1. Make input.js the single keyboard owner: delete renderer's keys map/listeners/getKeyboardMovement; getMovementInput() calls input.js getMovementDirection() (already merges kbd+gamepad). 2. Use gamepad.js pollGamepadMovement as the one stick reader (drop readMoveStick). 3. Add lockOn (and a dodge slot) to ACTIONS+DEFAULT_KEYBOARD with an onLockOn callback; renderer.applyLockOnPress stays, only dispatch moves. 4. Add isTypingTarget guard in input.js onKeyDown. 5. Remove the dead setGamepadInputHandler plumbing. 6. Collapse the redundant per-callback gamePhase==='playing' guards (main.js:766/769/3014/3023) now that canUseGameActions gates dispatch.

## Verification

SIMPLICITY + closes a latent typing-while-WASD trap. Makes dodge-roll/new key items cheap. Risk: movement is core — playtest WASD+gamepad+lock-on.
