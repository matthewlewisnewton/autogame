## Make Offering Terminal Siphon Direction Explicit

The reward layer calls `spawnProjectileTrail(origin, { x: 0, z: 0 }, ...)` and the test labels this as a vertical direction. The current primitive only understands X/Z direction and normalizes a zero vector into a stationary horizontal orientation, so a future polish pass should either use a real column-style primitive or add a helper that can express upward energy flow directly.

### Acceptance Criteria
- Offering Terminal's golden reward siphon uses a primitive or helper whose runtime behavior clearly matches the intended upward/returning energy flow.
- The renderer test asserts the actual runtime-supported direction/primitive semantics rather than treating `{ x: 0, z: 0 }` as vertical.
