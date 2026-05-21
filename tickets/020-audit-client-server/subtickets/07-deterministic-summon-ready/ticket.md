# Deterministic Summon-Ready Debug Scenario

The `summon-ready` debug scenario sets `magicStones = MAX_MAGIC_STONES` but leaves the hand randomized — 4 cards drawn from an 8-card deck that contains 3 weapons (`iron_sword`), 2 summons (`flame_blade`, `battle_familiar`), and 1 monster (`dungeon_drake`). Integration tests that depend on a summon card being present in hand (e.g., the low-mana rejection test) can fail when the random deal produces no summon.

Fix: after `enterPlayingPhase()` initializes the hand, ensure that at least one summon card is present in the player's hand by replacing an empty slot or a non-summon slot with a summon card drawn from the deck.

## Acceptance Criteria
- After `applyDebugScenario()` with `name === 'summon-ready'`, the player's hand contains at least one card of type `'summon'`.
- The low-mana rejection test (`rejects summon when not enough magic stones`) reliably finds a summon card in hand without needing a manual fallback.
- The hand still has exactly 4 cards (no extra cards are added beyond the standard hand size).
- Other debug scenarios (`summon-low-mana`, `combat-damaged-player`, `mixed-enemies`, `spawner-active`) are unaffected.

## Technical Specs
- **File**: `game/server/index.js` — In `applyDebugScenario()`, after the `enterPlayingPhase()` call (which initializes deck and hand), add logic for the `summon-ready` case:
  1. After `enterPlayingPhase()` returns, check if `player.hand` contains a summon card.
  2. If not, find a non-summon card slot and replace it by drawing a summon from the deck. Since the deck contains `flame_blade` and `battle_familiar` (both summons), a simple approach is:
     - Find the first slot with a non-summon card: `const replaceSlot = player.hand.findIndex(c => c && c.type !== 'summon');`
     - If found, replace: `player.hand[replaceSlot] = drawCardFromDeck(player);` — but this might draw another non-summon. So instead, directly place a known summon card:
       ```js
       if (!player.hand.some(c => c && c.type === 'summon')) {
         const replaceSlot = player.hand.findIndex(c => c && c.type !== 'summon');
         if (replaceSlot >= 0) {
           player.hand[replaceSlot] = { id: 'battle_familiar', name: 'Battle Familiar', type: 'summon', charges: 1, remainingCharges: 1, magicStoneCost: 50, damage: 40 };
         }
       }
       ```
  3. Place this check inside the `if (name === 'summon-ready')` block, after `player.magicStones = MAX_MAGIC_STONES`.
- **No other files changed.** Do not modify test files, client code, or other debug scenarios.

## Verification: code
