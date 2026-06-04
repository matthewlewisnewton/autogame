# Cleanup nits from 208-gameplay-card-permafrost-lance

> **Staleness note.** This follow-up ticket was written against commit
> `213fb77` (2026-06-04). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `208-gameplay-card-permafrost-lance`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Add a dedicated freeze-behavior assertion for permafrost_lance
`server/test/permafrost_lance.test.js` only verifies the static def fields and shop-pool
membership. The freeze/damage behavior is already covered transitively by the shared
`applyFreezeInRadius` tests for frost_nova and glacier_collapse, but a small assertion that
drives `CARD_DEFS.permafrost_lance` through that path would make the card's intent explicit
and guard against a future change that decouples the card from the shared branch. This is a
near-one-line addition mirroring the existing "Cryo Burst freezes enemies in radius" test.

### Acceptance Criteria
- A test calls `applyFreezeInRadius` (or the `useCard` flow) using
  `CARD_DEFS.permafrost_lance`'s `radius`, `freezeDurationMs`, and `damage`.
- It asserts an in-radius enemy becomes frozen and loses 8 HP.
- Full vitest stays green.
