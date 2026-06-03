# Cleanup nits from 163-cleanup-dedupe-card-defs-server-client

> **Staleness note.** This follow-up ticket was written against commit
> `61fecde` (2026-06-03). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `163-cleanup-dedupe-card-defs-server-client`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Refresh Card Type Comments
`game/client/cards.js` still has an old comment describing card types as `weapon | summon | monster`, while the live card definitions and design use `weapon`, `spell`, `creature`, and `enchantment`. Updating the comment would reduce future confusion around card taxonomy.

### Acceptance Criteria
- `game/client/cards.js` comments describe the current card type set accurately.

## Consider Sharing Desperation Card Identity
The normal `CARD_DEFS` identity data is now shared, but the separate desperation fallback cards still duplicate `id`, `name`, `type`, and `charges` between client and server. This is outside the accepted ticket scope, but it has the same maintenance risk if those fallback cards are renamed later.

### Acceptance Criteria
- Desperation fallback card identity is either shared between client and server or covered by an explicit sync test.
