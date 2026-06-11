# Cleanup nits from 322-anim-signal-familiar

> **Staleness note.** This follow-up ticket was written against commit
> `13b6a6bf` (2026-06-11). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `322-anim-signal-familiar`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Signal Familiar reuses `spawnMinionSummonInEffect` for a non-summon spell
`battle_familiar` is an instant radial-AoE spell that does not summon a persistent minion, yet its
cast flourish calls `spawnMinionSummonInEffect`. It reads fine on screen and is documented with a
comment, but the helper name implies a real minion summon and could mislead a future reader. A
small rename/alias (e.g. a generic `spawnSummonFlourish`) or an extra clarifying comment at the
call site would remove the ambiguity.
### Acceptance Criteria
- The cast flourish for `battle_familiar` no longer relies on a misleadingly-named helper, OR the
  call site carries a comment making clear no persistent minion is spawned.
- Existing Signal Familiar client tests still pass unchanged in behavior.
