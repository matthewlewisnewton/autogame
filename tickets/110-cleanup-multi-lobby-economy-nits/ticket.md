# Cleanup multi-lobby + MS economy nits

> **Staleness note.** This follow-up ticket was written against commit
> `b299845` (2026-05-23). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Smaller follow-ups from the `2fb2825` multi-lobby + magic-stone economy + free-discard rework. None are blocking, but together they make the lobby code path hard to reason about (mutable singleton stack semantics, undocumented redundant aliases, mismatched constants, drive-by client behavior shifts).

## Difficulty: medium

## Code references

> The references in this section were reviewed at commit `b299845`; verify them against the current code before editing.

- `game/server/index.js:248-263` — `withLobbyContext` mutates the global `_gameState`/sim state through a stack and is callable from inside other `withLobbyContext` callbacks (and is, e.g. from `applyLayoutForQuest`). Add a doc comment explaining stack semantics: when it is safe to nest, what it does to mid-flight emissions, and how exceptions unwind the stack.
- `game/server/index.js:299` — `applyLayoutForQuest` wraps `rebuildWallColliders()` in a fresh `withLobbyContext({ state })` even when already inside one. Either drop the inner wrap (if the caller's context is always correct) or document why a fresh wrap is required.
- `game/server/index.js:457` `applyDebugScenario` — returns from inside `withLobbyContext(...)`; the inner `if (!result.valid) return { ok: false, ... }` only exits the inner arrow. Re-indent or restructure so the control flow is obvious.
- `game/server/index.js` — `requireLobby` is a one-line alias of `getLobbyForSocket` with no semantic difference. Pick one.
- `game/server/progression.js` `replaceConsumedCard` — name `exhaustedCards` implies "post-desperation entry" semantics, but entries accumulate any time `remainingCharges <= 0`, including normal deck-phase exhaustion. Rename or document.
- `game/server/progression.js:1788` `discardCardFromHand` — calls `checkRunTerminalState()` unconditionally. Discarding during a healthy run still pays the cost of a full terminal check plus a redundant `stateUpdate` from inside `checkRunTerminalState`. Short-circuit on a cheap "is run still in progress" check first.
- `game/server/lobbies.js` `removePlayerFromLobby` — reassigns `lobby.hostId` to `Object.keys(...)[0]` (deterministic in modern engines but conceptually fragile) and emits no `hostChanged` event. Either emit one or document that clients re-derive host from state snapshots.
- `game/server/index.js:81` `createGameState` — `_pendingMinionBreaths` initialized with `_` prefix but is broadcast via `io.emit('cardUsed', ...)`. Add a comment that it is a queued buffer, not internal-only.
- `game/client/hand.js` — `inDesperation` exported as `let` and reassigned in `main.js:471`; only works because the consumer re-imports. Move it onto state or expose an explicit setter.
- `game/client/main.js` — `MAX_MS` comment says "must match server MAX_MAGIC_STONES" but the two constants live in separate files with no programmatic sync. Either import from a shared module or move the value into the state snapshot.
- `game/server/index.js` `spawnMagicStoneDrop` — spawns a drop on every kill (no roll), can produce dense MS clusters during waves. Confirm intent vs. the old `LOOT_SPAWN_CHANCE` behavior; if intentional, leave a note.
- `game/server/test/helpers.js` `connectClient` — resolves `{ socket, init: joined, session: data }` for the join path but `{ socket, init: data }` for `skipLobby`. The shapes are silently incompatible; downstream tests rely on the common subset. Normalize.

## Acceptance Criteria

- `withLobbyContext` has a clear contract documented in code; nested usage is either supported with a comment explaining why, or eliminated.
- `applyDebugScenario` reads cleanly: indentation and `return` shape match the control flow.
- `requireLobby` and `getLobbyForSocket` are one function (or the second is renamed/removed).
- `exhaustedCards` either has documented semantics matching its name, or is renamed.
- Healthy-run discards do not pay the full `checkRunTerminalState` cost (assert by a focused test that counts state emissions per discard).
- Lobby host hand-off either emits an explicit event or is documented as client-derived.
- Client/server `MAX_MS` cannot drift without a build/test failure.
- `connectClient` resolves a single shape; tests are updated to match.

## Technical Specs

- Likely files: `game/server/index.js`, `game/server/progression.js`, `game/server/lobbies.js`, `game/client/main.js`, `game/client/hand.js`, `game/server/test/helpers.js`.
- Keep behavior changes minimal unless explicitly listed in acceptance criteria; most of this is comments/renames/asserts.

## Verification: code
