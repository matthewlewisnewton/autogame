# Hosting: multi-instance auth + rate-limit readiness (shared JWT secret)

## Difficulty: medium

## Goal

For horizontal scale, auth must work identically on every instance with no per-instance auth state that breaks when a WS lands on a different machine. JWT is already stateless (verifyToken) with an env secret — confirm/require a single shared JWT_SECRET across instances and fail fast at boot if missing in production (already throws unless NODE_ENV=test). The in-process rate-limit sweep (startRateLimitSweep) is per-instance; either make it Redis-backed OR explicitly document and keep it per-instance if acceptable. No behavior change for single-instance.

## Acceptance Criteria

- JWT verification confirmed stateless + secret-driven with a clear boot failure if JWT_SECRET missing in production; rate-limiting Redis-backed OR documented per-instance; existing auth tests pass; single-instance behavior unchanged.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
