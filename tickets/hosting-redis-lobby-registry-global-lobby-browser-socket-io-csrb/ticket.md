# Hosting: Redis lobby registry + global lobby browser + socket.io adapter

## Difficulty: hard

## Goal

Horizontal scale needs cross-instance coordination. Add a Redis client (ioredis) via REDIS_URL with an in-memory fallback when unset (so single-instance/dev/tests are unaffected). Use it for: (1) a lobby->instance registry (record owner on create, remove on close), (2) a global lobby browser aggregated across instances (each instance publishes its lobbies; the browser reads the union), (3) the socket.io Redis adapter (@socket.io/redis-adapter) so broadcasts fan out across instances. When REDIS_URL is unset, behavior is identical to today. Tests must not require live Redis — use ioredis-mock or an in-memory shim.

## Acceptance Criteria

- With REDIS_URL set, lobbies register/deregister in Redis and the browser reflects all instances lobbies; socket.io uses the Redis adapter; with REDIS_URL unset behavior is identical to today; tests pass without live Redis.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
