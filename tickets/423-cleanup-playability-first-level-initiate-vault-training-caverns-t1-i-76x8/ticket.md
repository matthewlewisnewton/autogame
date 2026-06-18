# Cleanup nits from playability-first-level-initiate-vault-training-caverns-t1-i-76x8

> **Staleness note.** This follow-up ticket was written against commit
> `84af322d` (2026-06-18). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `playability-first-level-initiate-vault-training-caverns-t1-i-76x8`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Name the room-0 tutorial grunt balance literals

The room-0 wave-0 grunt overrides (`hp: 50`, `attackDamage: 7`) are inline magic numbers in
`game/server/quests.js`. They encode a deliberate tutorial-difficulty decision that future balance
tickets may need to find and tune. Lifting them to a named constant (e.g.
`TUTORIAL_GRUNT_STATS`) with a short comment explaining "halved HP / reduced damage so a cold-start
starter deck can clear the opening room" would make the intent discoverable and prevent accidental
regression.

### Acceptance Criteria
- The room-0 wave-0 grunt `hp`/`attackDamage` values are defined via a named, commented constant
  rather than bare literals in the spawn def.
- `tier1_quest_identity.test.js` and `training_caverns_room0_starter_fight.test.js` still pass.
