## Refresh Card Type Comments
`game/client/cards.js` still has an old comment describing card types as `weapon | summon | monster`, while the live card definitions and design use `weapon`, `spell`, `creature`, and `enchantment`. Updating the comment would reduce future confusion around card taxonomy.

### Acceptance Criteria
- `game/client/cards.js` comments describe the current card type set accurately.

## Consider Sharing Desperation Card Identity
The normal `CARD_DEFS` identity data is now shared, but the separate desperation fallback cards still duplicate `id`, `name`, `type`, and `charges` between client and server. This is outside the accepted ticket scope, but it has the same maintenance risk if those fallback cards are renamed later.

### Acceptance Criteria
- Desperation fallback card identity is either shared between client and server or covered by an explicit sync test.
