# 232-hub-shared-presence

## Difficulty: hard

## Goal

Shared multiplayer hub: broadcast hub player positions + cosmetics to all party/lobby members so you see others walking (networked lobby-phase presence). Structure the presence broadcast so it can later cull to nearby players (interest-management-ready); keep hub state on the lobby object, not globals.

## Acceptance Criteria

- 1. Party-mates' avatars (with cosmetics) render + move live in the shared hub. 2. Presence broadcast is per-lobby-scoped and structured for future per-player culling. 3. Join/leave updates presence correctly. 4. Tests.

## Verification

merge rejected: post-rebase verification failed
