## Derive Cryo Burst frost-field linger duration from the source of truth

`renderFrostNova` hardcodes `FROST_NOVA_FREEZE_MS = 2500` in
game/client/cardRenderers.js, duplicating `freezeDurationMs` from
game/shared/cardStats.json behind a manual "keep in sync" comment. If the
server freeze window is ever retuned (and note `permafrost_lance` already uses a
different 2000ms freeze on the same `frost_nova` effect branch), the client
linger silently desyncs. Prefer carrying the real `freezeDurationMs` in the
`CARD_USED` payload, or importing the value from a shared constant, so the
visual persistence always tracks the server.

### Acceptance Criteria
- The lingering frost-field decal duration is sourced from the server's actual
  `freezeDurationMs` (via payload or a shared import), not a client-side
  literal.
- Changing `freezeDurationMs` in cardStats.json updates the on-screen linger
  with no edit to cardRenderers.js.
- Existing frost_nova client tests still pass.
