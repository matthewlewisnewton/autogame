# Cleanup nits from 094-cleanup-cleanup-cleanup-cleanup-audit-client-server

> **Staleness note.** This follow-up ticket was written against commit
> `0c43ec7` (2026-05-21). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `094-cleanup-cleanup-cleanup-cleanup-audit-client-server`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Visual capture did not press the monster slot

The Gemini capture plan and screenshot descriptions target Dungeon Drake summon behavior, but the final probe’s `cardPress` exercised slot 1 (`battle_familiar` summon), not the monster slot. Runtime and the new integration test cover the server chain; the screenshot pass is weaker than the plan claims.

### Acceptance Criteria
- Harness capture for ticket 094 (or next monster QA) emits `useCard` / card press on the hand slot whose `type === 'monster'`.
- Post-capture probe shows `gameState.minions.length` increased and the monster slot replaced via `stateUpdate`.

## Consolidate duplicate monster integration setup

The older test `emits useCard, server spawns a minion in gameState.minions` still manually injects `dungeon_drake` into `player.hand` after `summon-ready`, while the new test correctly uses the `monster-card` scenario. Two patterns for the same setup add maintenance noise.

### Acceptance Criteria
- Refactor the older monster spawn test to use `monster-card` (or shared helper) instead of direct `player.hand` mutation.
- All server integration tests still pass.

## Assert minions on stateUpdate payload in new test

The new integration test checks `gameState.minions` after `useCard` but does not assert `updatedSnapshot.minions` from the awaited `stateUpdate`, though `stateSnapshot()` includes minions. Aligning the assertion with the ticket wording would catch replication gaps earlier.

### Acceptance Criteria
- Monster integration test expects `updatedSnapshot.minions` to include the new minion with correct `ownerId` and `hp`.
- Test still passes without client code involved.
