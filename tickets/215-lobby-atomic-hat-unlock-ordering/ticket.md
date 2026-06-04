# 215-lobby-atomic-hat-unlock-ordering

## Difficulty: medium

## Goal

unlockHat (game/server/index.js:1628-1675) is a non-atomic two-file write: currency lives in the per-player progress file (providers.js) while unlockedHats lives in users.json. It deducts currency in memory, writes the hat to users.json (L1662), then savePlayerData writes currency (L1673). A crash between the hat write and savePlayerData persists the hat while losing the currency deduction = a free hat on restart. Multiplies once paid currency unlocks ship.

## Acceptance Criteria

- 1. Reorder to persist currency BEFORE recording the unlock (unlock is already idempotent, users.js:293), so a crash leaves the player charged-but-not-unlocked (recoverable) rather than unlocked-but-not-charged (exploit). OR store unlockedHats + currency in the same persistence record so one atomic rename covers both. 2. Test that kills the write between steps.

## Verification

CORRECTNESS/exploit risk. Do before any paid currency unlock. Option (b) reorder is the smaller change. Risk: persistence ordering.
