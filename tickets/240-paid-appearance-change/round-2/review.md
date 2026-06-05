## Per-Criterion Findings

### Runtime health

PASS. The round-2 capture proves the game starts and loads cleanly: `metrics.json` has `"ok": true`, no `harness_failure`, and an empty `pageerrors` array. The capture reached normal lobby and gameplay states with canvases present, two connected players, movement probes, and the key-item cooldown HUD. `console.log` contains no `pageerror` or `[fatal]` lines from game code; the 409 resource lines are non-fatal auth/setup noise in the capture.

### 1. Appearance changes deduct gold atomically

PASS. Paid appearance edits now flow through the `applyAppearance` socket handler, which validates the cosmetic patch, compares non-hat appearance fields against the persisted account cosmetic, charges the live player, saves player currency first, and only then writes the account cosmetic. If the currency save fails, the in-memory charge is rolled back before the cosmetic update; if the profile update returns an error, currency is refunded and re-saved. The profile HTTP route rejects paid appearance fields, closing the prior bypass, while hat-only cosmetic changes remain free.

The ordering intentionally favors charged-but-unchanged after a crash between the player save and account save, avoiding the free-edit exploit described by the ticket. The persistence tests cover insufficient funds, currency-before-cosmetic ordering, crash-after-currency-save behavior, update failure refund, hat-only no-charge behavior, and currency-save failure rollback.

### 2. Price in config

PASS. `APPEARANCE_CHANGE_COST` is defined in shared constants, exported through server and client config, and exposed by `GET /api/me`. The client caches the server-provided cost and uses it in booth messaging and confirmation copy, so the displayed price is tied to configuration rather than duplicated UI magic.

### 3. Client confirm dialog

PASS. The character booth detects paid edits by mirroring the server's appearance-field comparison and calls `window.confirm` before emitting `applyAppearance`. Hat-only saves skip the paid confirm path, preserving free hat swaps. The confirm text includes the configured formatted price, cancellation prevents the socket emit, server errors are surfaced in the booth, and successful responses synchronize account cosmetic and currency HUD state.

### 4. Tests include insufficient-funds and crash-safety

PASS. Round-2 coverage shows `83` test files and `1593` tests passing. The new and updated tests include the required insufficient-funds rejection and crash-safety ordering checks, plus client confirm/hat-only behavior and profile-bypass rejection.

### Design and requirements consistency

PASS. The implementation fits the documented lobby/economy loop: appearance payment is handled in the hub/lobby layer, uses existing account and persistent player data, and does not alter dungeon rendering, movement synchronization, multiplayer state, or combat flow. The captured smoke run confirms the foundational requirements remain intact: 3D scene present, server/client socket connection active, multiplayer state present, and movement/key-item gameplay functioning.

### Debug shortcuts

PASS. This ticket did not add or change a `?debugScenario=NAME` shortcut. It did add/cover a localhost-only `?booth=character` UI capture shortcut; that shortcut only opens the booth after normal hub lobby entry and does not fabricate account state, currency, server validation, persistence, or replication.

## Remaining gaps

None.

VERDICT: PASS
