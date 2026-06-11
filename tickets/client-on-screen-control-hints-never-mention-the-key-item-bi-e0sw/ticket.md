# Client: on-screen control hints never mention the key item binding

## Difficulty: easy

## Goal

The gameplay hint line (game/client/index.html:88, #attack-hint: 'Click to attack - press 1-6 to cast cards') does not mention the use-key-item action even though it is a core combat tool with a configurable binding (game/client/input.js useKeyItem action; settings UI at index.html:399). Players have no in-game discovery of how to trigger their equipped key item. Extend the hint line (and/or the key item HUD tooltip from the persistent-slot bead) to include the current key item binding, resolved from the live keyboard/gamepad config rather than hardcoded. Found during live-view screenshot review 2026-06-09.

## Acceptance Criteria

- The gameplay hint line includes the use-key-item binding resolved from current settings (updates if rebound); shown only when a key item is equipped; a client test covers the resolved-binding text

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
