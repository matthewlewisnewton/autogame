# Server: auth rate-limit buckets grow without bound (slow memory exhaustion)

## Difficulty: easy

## Goal

rateLimitBuckets in game/server/auth.js:12,20-33 is keyed by action:ip:username and entries are never deleted — expired windows are only replaced when the same key recurs. An attacker spraying unique usernames or rotating IPs adds a Map entry per attempt, forever, in the same process that runs the game loop. Fix: sweep expired buckets on a timer (one setInterval deleting entries with now - windowStart >= WINDOW) or cap the Map size. Found in code review 2026-06-09.

## Acceptance Criteria

- Expired rate-limit buckets are pruned (timer sweep or size cap); rate limiting behavior for active windows unchanged; a test covers pruning

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
