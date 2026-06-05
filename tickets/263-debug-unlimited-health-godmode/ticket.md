# 263-debug-unlimited-health-godmode

## Difficulty: easy

## Goal

A debug invincibility/unlimited-health toggle for playtesting, gated like ALLOW_DEBUG_SCENARIOS (must NOT be header-spoofable — depends on 265).

## Acceptance Criteria

- Debug toggle makes the player take no damage; gated behind the hardened debug check; off in production. Test.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
