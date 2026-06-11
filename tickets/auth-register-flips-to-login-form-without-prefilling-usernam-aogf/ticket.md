# auth: register flips to login form without prefilling username (and no auto-login)

## Difficulty: easy

## Goal

Successful registration shows 'Account created — please login' and switches to the login form, but the username field is empty — the player must retype the name they typed two seconds ago. /api/login already exists and the client has both values in hand, so either auto-login after register or at minimum carry the username into the login form. Repro: open the client, register a new account via the UI, observe the empty login form. Verified the login-username input value is '' after the flip.

## Acceptance Criteria

- After a successful register, either the user is logged in automatically, or the login form is prefilled with the registered username and focus is on the password field.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
