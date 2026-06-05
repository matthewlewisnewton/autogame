## Normalize Extracted Handler Indentation
Several extracted socket handler callbacks in `game/server/socketHandlers/runHandlers.js` and nearby handler modules retain the old inline indentation level. Behavior is unaffected, but normalizing indentation would make future socket-handler reviews easier.

### Acceptance Criteria
- `game/server/socketHandlers/runHandlers.js` and adjacent touched handler modules use consistent indentation inside each `withLobby...` callback.

## Retire Stale Shop Buy Affordance
The server-side `buyShopCard` socket handler is intentionally removed and no client emitter remains, but the lobby shop still renders a `Buy` button element. If card buying is no longer a supported lobby action, removing or repurposing that inert button would avoid confusing future UI work.

### Acceptance Criteria
- The card shop UI no longer presents an enabled buy affordance unless there is a live supported purchase flow behind it.
