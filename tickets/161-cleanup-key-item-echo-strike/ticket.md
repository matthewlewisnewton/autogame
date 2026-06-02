# Cleanup nits from 132-key-item-echo-strike

> **Staleness note.** This follow-up ticket was written against commit
> `b7cd8d9` (2026-06-02). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `132-key-item-echo-strike`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Creature-card echo_strike regression test

Spell cards are tested to ensure they do not consume `echoStrikePending` or enqueue echoes, but there is no parallel test for `type: 'creature'` summon cards. The server branches are separate and should behave identically; a small test mirroring the frost_nova case would guard against future refactors accidentally merging branches.

### Acceptance Criteria
- With `echoStrikePending === true`, using a creature card does not set the flag to false and leaves `state.pendingEchoes` empty.
- A subsequent weapon hit still procs the echo (two damage packets) after the creature play.
