# 02 — Server: useCard cooldown bypass with overclock charges

Modify the `useCard` handler so that when `player.overclockChargesRemaining > 0`, slot cooldown checks are skipped and slot cooldowns are not assigned after successful card plays. Each successful card use consumes one charge.

## Acceptance Criteria

- When `overclockChargesRemaining > 0`, the slot cooldown check at the top of `useCard` is bypassed — a card in a cooling-down slot can still be played.
- After each successful card play, if `overclockChargesRemaining > 0`, the slot cooldown assignment is skipped and the charge is decremented.
- MS cost and all other card logic (charges, effects, exhaustion) still execute normally — overclock only affects slot cooldown.
- After both charges are consumed, subsequent card plays respect slot cooldowns normally.
- Overclock does NOT bypass deck-empty checks, hand-validation, or MS-cost checks.

## Technical Specs

- **`game/server/index.js`**:
  - In the `useCard` socket handler, after the existing cooldown check (line ~1427), modify the condition:
    ```javascript
    const now = Date.now();
    const hasOverclock = (player.overclockChargesRemaining || 0) > 0;
    if (!hasOverclock && player.slotCooldowns && player.slotCooldowns[data.slotIndex] && now < player.slotCooldowns[data.slotIndex]) {
      socket.emit('cardError', { reason: 'Slot on cooldown' });
      return;
    }
    ```
  - After each card branch's successful path (before `stateSnapshot` / `cardUsed` emit), wrap the `slotCooldowns` assignment:
    ```javascript
    if (hasOverclock) {
      player.overclockChargesRemaining -= 1;
    } else {
      player.slotCooldowns[data.slotIndex] = now + (cardDef.cooldownMs || COOLDOWN_MS);
    }
    ```
  - There are ~15 places where `slotCooldowns[slotIndex] = ...` is assigned in the `useCard` handler (lines ~1448, ~1554, ~1620, ~1639, ~1700, ~1729, ~1756, ~1777, ~1798, ~1820, ~1847, ~1887, ~1919, ~1957, ~2014, ~2052). Each must be wrapped with the overclock guard.
  - **Alternative (cleaner)**: define a helper function `applySlotCooldown(player, slotIndex, now, cooldownMs)` that checks `overclockChargesRemaining` internally, and replace all direct `player.slotCooldowns[...] = ...` assignments with calls to this helper. This reduces the diff surface and avoids copy-paste errors.

## Verification: code
