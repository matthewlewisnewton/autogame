# 265-sec-debug-gate-no-header-spoof

## Difficulty: easy

## Goal

isDebugScenarioAllowed (game/server/index.js:533-545) trusts client-controlled Origin/Host headers for its localhost check -> a remote attacker spoofs Origin:http://localhost to enable debug scenarios in any non-prod deploy.

## Acceptance Criteria

- Drop the Origin/Host checks; gate on the peer socket address and/or explicit env only. Test that spoofed Origin/Host headers do NOT enable debug.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
