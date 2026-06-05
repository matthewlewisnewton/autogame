# 266-sec-jwt-require-explicit-dev-auth

## Difficulty: easy

## Goal

auth.js:65-71 falls back to the known 'dev-secret' whenever NODE_ENV != production -> a staging/public deploy that forgets NODE_ENV=production signs JWTs with a known key (full auth bypass).

## Acceptance Criteria

- Require an explicit opt-in (e.g. ALLOW_DEV_AUTH=1) for the dev-secret fallback; otherwise fail closed (throw) when JWT_SECRET is unset. Test.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
