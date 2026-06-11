# Cleanup nits from 335-anim-offering-terminal

> **Staleness note.** This follow-up ticket was written against commit
> `f3921d60` (2026-06-11). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `335-anim-offering-terminal`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Make Offering Terminal Siphon Direction Explicit

The reward layer calls `spawnProjectileTrail(origin, { x: 0, z: 0 }, ...)` and the test labels this as a vertical direction. The current primitive only understands X/Z direction and normalizes a zero vector into a stationary horizontal orientation, so a future polish pass should either use a real column-style primitive or add a helper that can express upward energy flow directly.

### Acceptance Criteria
- Offering Terminal's golden reward siphon uses a primitive or helper whose runtime behavior clearly matches the intended upward/returning energy flow.
- The renderer test asserts the actual runtime-supported direction/primitive semantics rather than treating `{ x: 0, z: 0 }` as vertical.
