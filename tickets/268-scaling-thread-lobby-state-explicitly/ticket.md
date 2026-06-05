# 268-scaling-thread-lobby-state-explicitly

## Difficulty: medium

## Goal

Reduce reads of the global mutable _gameState (swapped per-lobby via withLobbyContext) by threading lobby/state explicitly through handlers — the blocker to ever running lobbies concurrently. Incremental.

## Acceptance Criteria

- Migrate a meaningful set of progression/handler call sites to take an explicit lobby/state arg instead of the global; tests green; behaviour unchanged.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
