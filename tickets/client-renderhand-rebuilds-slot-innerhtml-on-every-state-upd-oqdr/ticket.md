# Client: renderHand rebuilds slot innerHTML on every STATE_UPDATE even when the hand is unchanged

## Difficulty: easy

## Goal

The STATE_UPDATE handler calls renderHand() unconditionally while playing (game/client/main.js:1409-1428), i.e. at server broadcast rate. Each call re-sets content.innerHTML with a multi-badge template for all 5 slots, runs three :scope querySelectors per slot (getCardSlotParts) and toggles ~10 classes (main.js:2736-2836), forcing HTML re-parse and style/layout invalidation many times per second even when nothing changed. getCardChargePercent/formatCardChargesDisplay also scan gameState.minions per slot. Fix: compute a cheap per-slot signature (card id + charges + affordability + flags) and skip DOM writes when unchanged; only the --charge-pct var needs per-tick updates for burning creatures. Found in code review 2026-06-09.

## Acceptance Criteria

- renderHand performs no DOM writes when the per-slot signature is unchanged; charge percent still animates; existing hand tests pass plus one covering the skip path

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
