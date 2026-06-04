# 216-lobby-remove-dead-hostid

## Difficulty: easy

## Goal

Every lobby carries hostId and removePlayerFromLobby reassigns it (game/server/lobbies.js:46,84-95,120-123), lobbySummary ships it, but NO server handler authorizes anything on hostId (selectQuest/start are open to any member) and the client never reads it (zero references). Pure ceremony.

## Acceptance Criteria

- 1. Delete hostId, its reassignment logic, and its inclusion in lobbySummary (current behavior is 'anyone can act', so removal is behavior-preserving). 2. Tests green. (If host-governance is actually wanted, that's a separate feature — this ticket removes the dead version.)

## Verification

SIMPLICITY. Low risk. Decide before more handlers copy the 'anyone can do it' pattern.
