# Senior review — ticket 218 (lobby handler preamble & session helper)

## Runtime health (capture)

| Check | Result |
|-------|--------|
| `metrics.json` present | Yes |
| `ok` | `true` |
| `pageerrors` | `[]` (empty) |
| `failure_kind` / `harness_failure` | Absent |
| `console.log` | No `pageerror` or `[fatal]` lines |

Capture reached squad lobby, ready-up, and full gameplay (movement, dodge with cooldown HUD). Probes show `phase: "playing"`, `lobbyVisible: false`, `cardHandVisible: true`, and post-dodge `keyItemIndicatorOnCooldown: true` with remaining cooldown — consistent with a healthy client/server session.

Benign noise only: Vite connect lines and HTTP 409 on an early resource fetch (game still initialized scenes and completed the smoke flow).

## Acceptance criteria

### 1. `withLobbyPlayer(socket, { phase }, (state, lobby, player) => { ... })`

**Met.** Added at `game/server/index.js` (~636–650). It layers on `withLobbyFromSocket` (lobby membership + `lobbyError` when not in a lobby), optionally gates with `requirePhase: 'lobby' | 'playing'` via `isLobbyPhase` / `isPlayingPhase`, supports optional `phaseMismatch` emits, resolves `state.players[socket.playerId]`, and silently returns when the player record is missing (same as the old inline preambles).

Migrated handlers (mechanical 1:1 vs baseline `4b12f0c`):

| Handler | Wrapper options | Notes |
|---------|-----------------|-------|
| `selectQuest` | `requirePhase: 'lobby'` | Replaces `if (!isLobbyPhase(state)) return` |
| `playerReady` | `{}` (no phase gate) | Preserves prior behavior: ready toggles without lobby-only guard; `checkAllReady()` still gated by `isLobbyPhase(state)` inside |
| `deckAddCard`, `deckRemoveCard`, `evolveCard`, `sellCard`, `buyShopCard`, `unlockHat`, `grindCard` | `requirePhase: 'lobby'` | |
| `equipKeyItem`, `medicHeal` | `requirePhase: 'lobby'` + `phaseMismatch` | Preserves explicit `keyItemError` / `medicError` `not_in_lobby` responses |
| `offerCardTrade`, `respondCardTrade` | `requirePhase: 'lobby'` | |

Handlers that legitimately stay on `withLobbyFromSocket` only (playing-phase, run lifecycle, or non-lobby-player paths) were not part of this dedup goal: `move`, `discardCard`, `useKeyItem`, `returnToLobby`, `giveUp`, `abandonRun`, `claimCardReward`, loot pickup, etc.

No remaining `gamePhase !== 'lobby'` string checks in `index.js`; phase checks use the shared `isLobbyPhase` helper from ticket 217’s phase model.

### 2. `buildSessionFromPlayer(player)`

**Met.** Extracted (~729–738) and used at both former duplicate literal sites:

- Connection: `lobbies.registerSession(playerId, buildSessionFromPlayer(sessionPlayer))`
- `leaveLobby`: `lobbies.getSession(playerId) || buildSessionFromPlayer(sessionPlayer)`

Field set matches the previous inline object (`playerId`, `accountId`, `username`, `selectedDeck`, `inventory`, `ownedCards`, `currency`).

### 3. Tests green

**Met for ticket scope.** Round-1 `coverage.log`: **917 passed** (40 server test files). Targeted re-run of touched server tests (`guard_block`, `key-items`, `smoke_bomb`): **69 passed**. Unrelated flake: full `pnpm test:quick` reported 1 failure in `auth.test.js` (JWT `accountId` mismatch) — not in this ticket’s diff and not reproduced in the capture suite.

Test diffs in this branch only relax timing assertions on key-item cooldown/duration checks (elapsed-ms tolerance), not lobby-handler behavior.

## Design & requirements consistency

- **design.md / requirements**: Pure server refactor; no client protocol, combat, or lobby UX changes. Aligns with “SIMPLICITY, mechanical/incremental” verification note.
- **Integration**: Builds on 217’s `isLobbyPhase` / `isPlayingPhase` rather than raw `gamePhase` string compares — correct consolidation.
- **Behavior parity**: Diff shows no logic changes inside handler bodies beyond preamble removal; `equipKeyItem` and `medicHeal` retain explicit phase-mismatch errors; `playerReady` still omits a lobby-only entry guard.

## Code quality

- Helpers are small, documented with JSDoc for options, and colocated with existing `withLobbyFromSocket`.
- No dead code or broken imports introduced.
- Minor style: several callbacks receive `lobby` but do not use it (acceptable for uniform signature; optional cleanup only).

## Debug scenarios

No new or changed `?debugScenario=` entry points in this ticket. N/A.

## Screenshots & probes

- `01-initial.png`: Squad lobby with contract terminal, loadout bay, two players standby — lobby path works.
- `02`–`04`: In-run HUD, movement, dodge cooldown — post-lobby gameplay unaffected.
- Probes confirm dodge cooldown UI and return to ready state after cooldown.

## Remaining gaps

None blocking. All acceptance criteria are satisfied; captured run is clean; refactor is complete for the handlers named in the ticket goal.

VERDICT: PASS
