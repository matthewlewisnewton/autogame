# 231-hub-lobby-phase-movement

## Difficulty: medium

## Goal

Allow walking the hub with the existing movement input while gamePhase==='lobby' (server accepts + bounds hub-phase moves to hub geometry). Thread lobby/state explicitly (do NOT add new _gameState global reads).

## Acceptance Criteria

- 1. Player can move in the hub during the lobby phase (server validates like in-run move: finite, sequence, magnitude). 2. Movement bounded to hub geometry. 3. Test for lobby-phase move accept/bounds.

## Verification

merge rejected: post-rebase verification failed
