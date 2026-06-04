## Runtime health

The captured game run starts and loads cleanly. `metrics.json` reports `"ok": true`, no harness startup failure, and an empty `pageerrors` array. `console.log` contains Vite connection messages and 409 resource lines, but no `pageerror` or `[fatal]` entries from game code. The smoke capture reached the lobby, entered gameplay with two connected players, rendered the 3D scene/canvas, synchronized movement, and exercised dodge cooldown HUD state.

## Acceptance criteria

Criterion: Persist currency before recording the hat unlock, or co-locate currency and unlocked hats in one atomic record.

The implementation reorders the happy-path calls in `game/server/index.js`: `unlockHatForPlayer()` deducts currency, `savePlayerData(socket.playerId)` is called, then `unlockHatForAccount()` records the hat in `users.json`. That addresses the literal statement-order crash window where a process dies after a successful progress save but before the account unlock.

However, this is not robust enough to satisfy the criterion because `savePlayerData()` in `game/server/progression.js` is best-effort: it catches provider write errors, logs them, and returns `undefined`. The `unlockHat` handler does not know whether currency was actually persisted before it proceeds to `unlockHatForAccount()`. If the progress write fails while `users.json` remains writable, the server can still persist the hat unlock while the player's currency file retains the pre-purchase balance, recreating the free-hat exploit the ticket is meant to close.

Criterion: Test that kills the write between steps.

`game/server/test/hat_unlock_persistence.test.js` adds focused coverage for successful ordering, for a simulated users-file write interruption after the currency file is written, and for refunding when account unlock validation fails. Coverage output shows the full suite passed: 40 test files and 912 tests. The missing case is the blocking one above: a failed first currency persistence attempt must prevent the account unlock from being recorded.

## Design and requirements consistency

The changes are server-side persistence only and do not alter the documented core loop, lobby/dungeon flow, floor geometry, combat model, or foundation requirements. The captured run still demonstrates 3D rendering, WebSocket connectivity, multiplayer presence, and movement synchronization.

## Debug scenarios

No development debug scenario was added or changed by this ticket. `metrics.json` also reports no captured scenarios.

## Remaining gaps

1. Currency persistence is attempted before the hat unlock, but not verified; `savePlayerData()` swallows provider errors, so `unlockHatForAccount()` can still persist `unlockedHats` after the currency write failed. This leaves the same free-hat state possible when progress storage fails but `users.json` succeeds.

VERDICT: FAIL
