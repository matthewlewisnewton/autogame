## Remove Unused Debug Booth Constant

`game/client/main.js` computes `debugBoothAllowed`, but the actual host gating is centralized in `game/client/boothDeck.js`. Removing the unused local constant would keep the debug-hook wiring easier to read.

### Acceptance Criteria
- `debugBoothAllowed` is removed from `game/client/main.js`.
- `?booth=deck` remains gated by `shouldOpenDebugBooth()` tests.

## Narrow Server Fault Isolation

The server resilience change intentionally keeps the harness alive, but the process-level `uncaughtException` and `unhandledRejection` handlers are broad. A follow-up should prefer scoped socket/tick isolation where possible and reserve process-level logging for truly fatal startup/runtime failures.

### Acceptance Criteria
- Server fault handling is documented or narrowed so expected socket/tick failures are isolated without silently continuing after unrelated fatal process errors.
- Existing ready/deploy resilience tests continue to pass.
