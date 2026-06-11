# combat/balance: deck exhaustion soft-locks a run — no cards castable, run never ends

## Difficulty: medium

## Goal

A run can reach a state where the player cannot deal any damage and the run never resolves. Observed on Frost Crossing tier 1 (also nearly on Ember Descent): after casting through the full deck, HUD shows 'No cards left' (desperation counter also at 0), the only card in hand is Signal Familiar (50 MS) with MS at 25/99, and MS does not regenerate passively (sat at 25/99 for 6+ minutes; MS only seems to come from loot pickups, and with no enemies left to kill there is no loot). runStatus stays 'playing' indefinitely. The only escape is the Lv (level settings) overlay's 'Give up' button, which a new player is unlikely to find. A 'run-exhausted' debug scenario exists, suggesting an intended exhaustion fail-state that does not actually trigger. Expected: either a guaranteed always-available basic attack, passive MS regen, or an automatic run-exhausted failure when no resource path remains.

## Acceptance Criteria

- A run where the deck+desperation cards are fully consumed and MS is below every remaining castable cost either (a) still lets the player attack via some baseline action, or (b) auto-resolves to the exhausted/failed state within a short grace period; a server test covers the exhausted-with-insufficient-MS state.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
