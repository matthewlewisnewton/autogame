## Refresh Stale Open-Plaza Generator Comment

`generateOpenPlaza()` still documents the plaza output as identical for any seed, but cover placement is now seeded and intentionally differs by seed. This does not affect behavior, but the stale comment can mislead future layout work.

### Acceptance Criteria
- The `generateOpenPlaza()` seed documentation accurately states that the arena shell is fixed while cover placement is deterministic per seed.
