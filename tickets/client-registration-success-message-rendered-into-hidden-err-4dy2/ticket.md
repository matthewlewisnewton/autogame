# Client: registration success message rendered into hidden error field; no auto-login after register

## Difficulty: easy

## Goal

Found while playtesting (2026-06-09). After submitting the register form the UI silently switches to a blank login form. The confirmation text ("Account created - please login") is written into an element that is hidden at that moment, so the user sees no feedback at all and may assume registration failed.

REPRO
1. Open the game, switch to Register, submit a new username/password.
2. Observe: form swaps to Login with empty fields, no visible message (the success string is present in the DOM in a hidden error/status field).

FIXED WHEN
Either registration auto-logs-in, or the login form visibly shows the success message after the swap.

Difficulty: easy. UI-only; auth flow is in game/client/main.js (commit b4a5bb8, search for the register submit handler — lines will have drifted).

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
