# Detect combat exhaustion beyond empty deck piles

## Description

`isPlayerOutOfCards()` only returns true when hand, deck, and desperation piles are all empty. A player can still be soft-locked with cards in hand that cannot be cast (zero charges, creature slot locked, or Magic Stones below `magicStoneCost`). Add server-side helpers that detect when a player has no remaining combat options, treating MS-insufficient spells as uncastable at the current stone count.

## Acceptance Criteria

- `canPlayerCastHandCard(player, handCard)` returns false when the card has `remainingCharges <= 0`, has `activeMinionId` set, or `player.magicStones` is below the card's `magicStoneCost` (default 0)
- `canPlayerCastHandCard` returns true for a weapon with remaining charges and sufficient MS (or zero MS cost)
- `isPlayerCombatExhausted(player)` returns true when `canDrawIntoHand(player)` is false and every non-null hand slot fails `canPlayerCastHandCard`
- `isPlayerCombatExhausted` still returns true for the existing empty-hand/deck/desperation case (backward compatible with current `isPlayerOutOfCards` semantics)
- `isPlayerCombatExhausted` returns false when the deck or desperation pile still has drawable cards, even if the current hand is entirely uncastable
- `isPlayerCombatExhausted` returns false when at least one hand card is castable (e.g. `iron_sword` with charges and 0 MS cost)
- Unit tests in `game/server/test/server.test.js` cover: empty piles (true), MS-insufficient spell in hand with empty deck/desperation (true), drawable deck remaining (false), castable weapon in hand (false)

## Technical Specs

- **File**: `game/server/progression.js`
  - Add `canPlayerCastHandCard(player, handCard)` near the existing hand/deck helpers (~line 2377)
  - Add `isPlayerCombatExhausted(player)` that gates on `canDrawIntoHand(player)` first, then scans `player.hand`
  - Export both from the module exports block and from `game/server/index.js` test provider surface
- **File**: `game/server/test/server.test.js`
  - New `describe('combat exhaustion detection')` block with the cases listed above
  - Use `battle_familiar` / `magicStoneCost: 50` with `magicStones: 25` for the MS-insufficient stall case

## Verification: code
