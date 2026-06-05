# 03 — Slim per-tick stateUpdate on the server

Split snapshot construction so the 20Hz game loop broadcasts a hot payload only. Cold per-player collection fields stay available through full snapshots on event-driven emits and through `deckUpdate` / `cardInventoryUpdate` from sub-ticket 02.

## Acceptance Criteria

- New `hotStateSnapshot()` (or equivalent) in `progression.js` includes per-player hot fields: position (`x`,`y`,`z`), `rotation`, `hp`, `dead`, `ready`, `magicStones`, `currency`, `extracted`, combat/status flags (`isInvulnerable`, `isBlocking`, `blockingUntil`, `blockingYaw`, barrier/smoke fields, `keyItemCooldownRemaining`, `overclockChargesRemaining`), `equippedKeyItemId`, `cosmetic`, `username`, plus lobby/world fields: `enemies`, `minions`, `loot`, `lobby`, `gamePhase`, `selectedQuestId`, `selectedQuestTier`, `run`, `dungeonBounds`, `layoutSeed`, `currency`, `shopOffer`, `telepipe`, `suspendedRunSummary`.
- Hot snapshot **excludes** per-player cold fields: `deck`, `desperationDeck`, `hand`, `ownedCards`, `inventory`, `selectedDeck`, `runRewards`, `currencyEarnedThisRun`, `returnRewardsPreview`, `inDesperation`, `nextDrawAt`, `debugScenario`.
- `runGameLoopTick` in `index.js` emits `hotStateSnapshot()` instead of `stateSnapshot()` on the tick path only.
- Ad-hoc `stateUpdate` emits (deploy, card effects, key items, debug scenarios, `returnPlayersToLobby`, etc.) may continue using full `stateSnapshot()` until the client is trimmed.
- `stateSnapshot()` remains exported for tests and one-shot full syncs; its public field set is unchanged for non-tick callers.
- Server tests assert tick-emitted `stateUpdate` lacks cold fields (e.g. `players[id].inventory`, `players[id].hand`) while full `stateSnapshot()` still includes them.

## Technical Specs

- **`game/server/progression.js`**
  - Implement `hotStateSnapshot()` by factoring shared lobby/world assembly out of `stateSnapshot()`.
  - Keep `stateSnapshot()` as the union of hot + cold player slices (or thin wrapper) so non-tick code paths stay correct.
  - Reuse hoisted `shopOffer` / `suspendedRunSummary` from sub-ticket 01.
- **`game/server/index.js`**
  - In `runGameLoopTick` (~1121–1122), replace `stateSnapshot()` with `hotStateSnapshot()` for the periodic `io.to(lobby.id).emit('stateUpdate', …)`.
- **`game/server/test/server.test.js`**
  - Add tests for `hotStateSnapshot()` field presence/absence.
  - Extend or add a tick-broadcast test verifying emitted payload shape.

## Verification: code
