# Server: card wind-up state and input lock

Introduce the server-authoritative player card commitment state, mirroring the
existing enemy wind-up pattern (`attackState: "windup"`, `windupStartTime`,
`attackWindupMs` in `simulation.js`). Add optional per-card `windUpMs` in shared
card stats and, when a card with `windUpMs > 0` is used, enter commitment
instead of resolving instantly. While committed, the server rejects movement and
additional card-use input. This sub-ticket covers state, input lock, snapshot
exposure, and wind-up entry — deferred effect resolution is sub-ticket 02.

## Acceptance Criteria

- `game/shared/cardStats.json` supports an optional `windUpMs` number on any
  card; at least one exemplar high-damage weapon (e.g. `magma_greatsword`) is
  given a non-zero `windUpMs` so the mechanic is exercisable in-game.
- `getCardDef(cardId)` exposes `windUpMs` for cards that define it (merged from
  `CARD_STATS` like other stat fields).
- Player entities gain commitment fields mirroring enemies, e.g.
  `cardUseState: "windup"`, `cardWindupStartTime`, `cardWindupMs`, and a
  `pendingCardUse` payload `{ slotIndex, cardId, rotation, ... }` holding the
  deferred use data.
- A helper such as `isPlayerCardCommitted(player)` returns `true` only while
  `cardUseState === "windup"` and `Date.now() - cardWindupStartTime <
  cardWindupMs`.
- `socketHandlers/runHandlers.js` `MOVE` handler ignores/rejects input when the
  player is card-committed (position must not change from new move packets).
- `simulation.js` `applyPlayerMovement` skips card-committed players (same as
  enemies that `continue` during wind-up).
- `cardEffects.js` `handleUseCard`: if the player is already committed, emit
  `CARD_ERROR` (or silently reject) and return; if `cardDef.windUpMs > 0`, run
  the usual validation (hand, cooldown, MS cost), consume the charge/cooldown at
  **commit start**, set commitment fields + `pendingCardUse`, broadcast
  `STATE_UPDATE`, and **do not** deal damage or emit `CARD_USED` yet.
- Cards with no `windUpMs` (or `0`) still follow the existing instant path
  unchanged.
- `buildPlayerHotSnapshot` in `progression.js` exposes commitment to clients
  (e.g. `cardUseState`, `cardWindupUntil`, `cardWindupCardId`).
- Commitment state is cleared on player death, telepipe extract, and run
  suspend/lobby reset (transient — not checkpointed).
- New server tests verify: (a) a `windUpMs` card enters commitment and blocks
  movement + second `useCard`; (b) no enemy damage / no `CARD_USED` until
  resolution (sub-ticket 02); (c) `iron_sword` without `windUpMs` is still
  instant.

## Technical Specs

- `game/shared/cardStats.json` — add `windUpMs` to one exemplar weapon (e.g.
  `magma_greatsword: { ..., "windUpMs": 800 }`). Leave all other cards without
  the field for backward compatibility.
- `game/server/simulation.js` — add `isPlayerCardCommitted(player)` near the
  enemy wind-up helpers (~lines 2488–2532). Export it. In `applyPlayerMovement`
  (~line 472), `continue` when `isPlayerCardCommitted(player)`.
- `game/server/socketHandlers/runHandlers.js` — in the `MOVE` handler (~line
  101), return early when `isPlayerCardCommitted(player)`.
- `game/server/cardEffects.js` — at the top of `handleUseCard` (~line 165),
  reject if already committed; after validation, branch: `windUpMs > 0` → set
  player commitment fields + `pendingCardUse`, emit `STATE_UPDATE`, return;
  else existing instant branches unchanged.
- `game/server/progression.js` — extend `buildPlayerHotSnapshot` (~line 2949)
  with `cardUseState`, `cardWindupUntil` (computed end timestamp), and
  `cardWindupCardId`.
- `game/server/test/card_windup_state.test.js` (new) — unit/integration tests
  for commitment entry, movement lock, duplicate `useCard` rejection, snapshot
  fields, and instant-card control case.

## Verification: code
