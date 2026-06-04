# 03 — Abort hat unlock when currency persistence fails

`unlockHat` already persists currency before `unlockHatForAccount`, but `savePlayerData()` swallows
provider errors and returns no signal. The handler must treat a failed currency write as a hard
stop: refund the in-memory deduction, emit `hatError`, and never record the hat on the account.

## Acceptance Criteria

- `savePlayerData(playerId)` returns a boolean: `true` when the provider write succeeds (or when
  there is nothing to save because provider/player is missing — same as today’s no-op paths),
  `false` when `provider.savePlayer` throws. It must still catch/log errors and not throw to
  callers that ignore the return value.
- In `socket.on('unlockHat', …)`, after `unlockHatForPlayer` succeeds, if
  `savePlayerData(socket.playerId)` returns `false`:
  - add `result.cost` back to `player.currency` in memory;
  - do **not** call `unlockHatForAccount`;
  - emit `hatError` with a stable reason (e.g. `'Failed to save progress'`);
  - return without emitting `hatUnlocked`.
- On the success path, behavior from sub-tickets 01–02 is unchanged: currency save still runs
  before account unlock; refund + second save still runs when account unlock fails.
- `game/server/test/persistence.test.js` still passes (update the existing “catches and logs
  errors” case to assert `savePlayerData` returns `false` when the provider throws).
- `game/server/test/hat_unlock_persistence.test.js` gains a case where `provider.savePlayer`
  throws while persisting the post-deduction currency and `users.json` remains writable: after
  the handler finishes and after `reloadFromDisk`, account `unlockedHats` does **not** include
  the hat and progress `currency` is the pre-purchase amount; the client receives `hatError`, not
  `hatUnlocked`.
- `pnpm test:quick` passes (or the narrowest vitest filter covering the touched test files).

## Technical Specs

- `game/server/progression.js` — `savePlayerData(playerId)` (~L1169–1178):
  - Return `true` after a successful `provider.savePlayer`.
  - Return `false` in the `catch` block (keep existing `console.error` log).
  - Return `true` early when `!provider` or `!player` (preserve current no-op semantics).
- `game/server/index.js` — `unlockHat` handler (~L1654–1675):
  - Capture `const saved = savePlayerData(socket.playerId)` after `unlockHatForPlayer` succeeds.
  - On `!saved`, refund `player.currency += result.cost`, emit `hatError`, return before
    `unlockHatForAccount`.
  - Do not change ordering for the happy path or the existing account-unlock failure refund.
- `game/server/test/persistence.test.js` — extend the provider-throw test to expect return `false`.
- `game/server/test/hat_unlock_persistence.test.js` — add `"does not unlock hat when currency save throws"` (or similar) using `vi.spyOn(fileProvider, 'savePlayer')` to throw when
  `data.currency === expectedCurrency`, then assert disk + socket outcomes above.
- Do not change client code. Avoid widening `savePlayerData` behavior for unrelated handlers beyond
  the boolean return (call sites may keep ignoring it).

## Verification: code
