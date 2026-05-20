# Cleanup nits from 023-cleanup-loot-and-currency

> **Staleness note.** This follow-up ticket was written against commit
> `b469600` (2026-05-19). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `023-cleanup-loot-and-currency`.
None blocked acceptance — clean them up when convenient.

## Tighten `pickedUpLootIds` doc comment

The declaration at `game/client/main.js:661` says the set is "cleared on each
stateUpdate", but the actual `stateUpdate` handler (`game/client/main.js:576-585`)
only prunes ids that disappear from `state.loot` — it does not clear the set.
The comment is mildly misleading; the implementation itself is correct. Updating
the comment to match (e.g. "pruned on each stateUpdate to drop ids no longer
present in state.loot") would prevent future confusion.

### Acceptance Criteria
- The comment near the `pickedUpLootIds` declaration accurately describes the
  pruning behaviour (per-id removal on `stateUpdate`, not wholesale clearing).
