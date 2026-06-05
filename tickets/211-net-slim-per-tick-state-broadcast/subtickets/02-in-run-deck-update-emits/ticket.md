# 02 — Emit deckUpdate on in-run deck/hand changes

Before slimming the per-tick `stateUpdate`, wire the server to push cold deck/hand data through the existing `deckUpdate` event whenever it mutates during a run. Lobby deck-editor flows already emit `deckUpdate`; extend the same channel for combat-time changes.

## Acceptance Criteria

- A shared server helper (e.g. `emitPlayerDeckUpdate(playerId)`) emits `deckUpdate` to the owning player's socket with at least: `deck`, `hand`, `desperationDeck`, `inDesperation`, `nextDrawAt`, and `runRewards` when present.
- `deckUpdate` fires after card play (`useCard` / card effect resolution), passive draws (`processPassiveDraws`), opening-hand deal at deploy, desperation transitions, and any other code path that mutates `hand` or `deck` during `gamePhase === 'playing'`.
- `cardInventoryUpdate` continues to cover lobby inventory/currency mutations (`sellCard`, `buyShopCard`, trades, grind/evolve results already covered).
- Per-tick `stateUpdate` still includes the full player snapshot (this sub-ticket adds redundant cold pushes; slimming comes next).
- Server tests demonstrate at least one in-run scenario: play a card (or trigger a draw) and receive `deckUpdate` with an updated `hand` on that player's socket only.

## Technical Specs

- **`game/server/progression.js`**
  - Add `emitPlayerDeckUpdate(playerId, extra = {})` using `getIoTarget()` and the player's `activeSocketId` (mirror lobby handler payload style).
  - Export if needed by other modules.
- **`game/server/cardEffects.js`**
  - After successful card resolution that changes `hand`/`deck`/`desperationDeck`, call `emitPlayerDeckUpdate`.
- **`game/server/index.js`**
  - After `processPassiveDraws(now)` mutates hands, emit `deckUpdate` for affected players.
  - On deploy / run start paths that deal the opening hand, emit initial `deckUpdate` per player.
- **`game/server/socketHandlers/lobbyHandlers.js`**
  - No change required unless deploy/start logic lives here; wire emits at the authoritative mutation site.
- **`game/server/test/integration.test.js`** (or a focused new test file)
  - Add coverage for in-run `deckUpdate` after `useCard` or passive draw.

## Verification: code
