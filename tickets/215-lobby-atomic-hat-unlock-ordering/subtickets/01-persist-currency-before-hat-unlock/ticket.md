# 01 — Persist currency before hat unlock

Reorder the `unlockHat` lobby socket handler so currency is written to the per-player
progress file before `unlockedHats` is written to `users.json`. A crash between those
steps must leave the player charged-but-not-unlocked (retryable via idempotent
`users.unlockHat`) instead of unlocked-but-not-charged (free-hat exploit).

## Acceptance Criteria

- On a successful unlock, `savePlayerData(socket.playerId)` runs after
  `unlockHatForPlayer` deducts currency and **before** `unlockHatForAccount` records
  the hat.
- On success, the handler still emits `hatUnlocked` with the updated `unlockedHats`
  and `currency`, and may call `savePlayerData` again at the end (idempotent) if the
  existing pattern is kept.
- If `unlockHatForAccount` fails after currency was persisted, the handler refunds
  `player.currency` in memory **and** calls `savePlayerData` again so the refund is
  on disk (not only in RAM).
- Early-validation paths (missing `hatId`, unknown account, already-owned hat,
  `unlockHatForPlayer` failure) still emit `hatError` and perform no persistence
  writes.
- Comments in the handler describe the safe ordering (currency first, hat second)
  and why the refund path must re-save.

## Technical Specs

- `game/server/index.js` — `socket.on('unlockHat', …)` block (~L1628–1675):
  - Move `savePlayerData(socket.playerId)` to immediately after a successful
    `unlockHatForPlayer` call and before `unlockHatForAccount`.
  - In the `!unlockResult.ok` branch, after `player.currency += result.cost`, add
    `savePlayerData(socket.playerId)` so a failed account write does not leave
    deducted currency on disk.
  - Update the comment that currently says persistence failure refunds currency
    (refund must now include a second `savePlayerData`).
- No changes to `game/server/users.js`, `game/server/progression.js`, or client code
  unless a minimal export is required for tests (prefer not).

## Verification: code
