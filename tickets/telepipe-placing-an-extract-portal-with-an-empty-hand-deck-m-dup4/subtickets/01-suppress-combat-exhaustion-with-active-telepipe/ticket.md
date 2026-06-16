# Suppress combat-exhaustion failure while an active telepipe awaits extraction

## Description

When a player places Telepipe as their last card, `exhaustHandSlot` → `checkRunTerminalState` immediately sees every in-dungeon player as combat-exhausted with no drawable cards (`isPlayerOutOfCards` is true with no grace delay) and sets `run.status = 'failed'` before the player can walk through the portal. Add a server guard so combat-exhaustion terminal failure is deferred while a placed telepipe portal is on the field and at least one squadmate remains active in the dungeon.

## Acceptance Criteria

- After telepipe placement consumes the caster's last hand card and both deck and desperation deck are empty, `checkRunTerminalState()` leaves `run.status` as `'playing'` (not `'failed'`).
- `tickCombatExhaustionGrace()` does not promote the run to `'failed'` while `_gameState.telepipe` is set and a non-extracted active player remains in the dungeon.
- Once the telepipe is cleared (e.g. all players extract and the run suspends) or no active in-dungeon players remain, normal combat-exhaustion failure behavior is unchanged: a solo player with empty hand/deck/desperation and no telepipe still fails immediately.
- Existing telepipe suspend/resume flow is unaffected: after portal grace expires, `tryEnterTelepipe` + `maybeSuspendRun` can still set `run.status` to `'suspended'` and return players to the hub.

## Technical Specs

- **Edit:** `game/server/progression.js`
  - Add a small helper near `isPortalEntryGraceActive()` (around L1227), e.g. `isRunAwaitingTelepipeExtraction()`, that returns true when `_gameState.telepipe` exists, `_gameState.run.status === 'playing'`, and at least one `isPlayerActive` player has `extracted !== true`.
  - In `isPlayerCombatExhaustionFailureReady()` (L3458), return `false` early when `isRunAwaitingTelepipeExtraction()` is true. This is the single choke point used by both `tickCombatExhaustionGrace()` and the combat-exhaustion branch of `checkRunTerminalState()`.
  - Do **not** change `isPlayerCombatExhausted()` or `isPlayerOutOfCards()` — telepipe in hand must remain castable; only suppress the **run-failure** transition after the portal is placed.
- **No client changes.** `game/server/cardEffects.js` telepipe placement path already logs `[telepipe] placed at …` and calls `consumeSpellSlot()`; no edits required there.

## Verification: code
