# 269-lobby-enforce-max-players-cap

## Difficulty: easy

## Goal

Cap each lobby at MAX_PLAYERS=16 and reject join when full (lobby-finder routes/creates another lobby). Spawn assignment stays mod-4 (up to 4 stacked per spawn point at the cap).

## Acceptance Criteria

- MAX_PLAYERS=16 in config; join rejected with a clear lobbyError when full. TEST: a player who joins then leaves (both explicit-leave AND disconnect paths) decrements the count and frees the slot; counts never drift/leak; a freed slot allows a new join even after the lobby was at 16.

## Verification

merge rejected: post-rebase verification failed
qwen failed (rc=2)
