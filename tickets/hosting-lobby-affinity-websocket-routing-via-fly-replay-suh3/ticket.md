# Hosting: lobby-affinity WebSocket routing via Fly-Replay

## Difficulty: hard

## Goal

Each lobby's authoritative game state lives in-memory on one instance (the tick loop cannot be externalized). When a connection lands on an instance that does NOT own the target lobby, look up the owner in the Redis lobby registry and route to it via Fly replay (respond with Fly-Replay: instance=<machine_id> on the initial handshake/HTTP so Fly re-routes to the owning machine). Handle: owner is self (no replay), owner unknown (assign one — least-loaded or self), join-by-code. Read this instance's machine id from FLY_MACHINE_ID. Keep single-instance behavior when off Fly / REDIS_URL unset (always self).

## Acceptance Criteria

- A connection for a lobby owned by instance B but arriving at A is replayed to B via Fly-Replay; self-owned lobbies are not replayed; lobby creation assigns+records an owner; off-Fly/single-instance always routes to self with no behavior change; logic unit-tested with machine id + registry mocked.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
