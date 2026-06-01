# 05 — Tests: overclock charges expire on run end and redeploy

Add regression tests that verify `overclockChargesRemaining` is cleared to `0` when a run ends (victory or failure), when players are returned to lobby, when a run is given up, and before a fresh non-suspended run starts.

## Acceptance Criteria

- Test: `checkRunTerminalState()` clears `overclockChargesRemaining` on victory — set charges to 2, trigger victory, assert charges are `0`.
- Test: `checkRunTerminalState()` clears `overclockChargesRemaining` on failure — set charges to 2, trigger failure (all players dead), assert charges are `0`.
- Test: `returnPlayersToLobby()` clears `overclockChargesRemaining` — set charges to 2, call `returnPlayersToLobby()`, assert charges are `0`.
- Test: `giveUpRun()` clears `overclockChargesRemaining` — set charges to 2, call `giveUpRun()`, assert charges are `0`.
- Test: `checkAllReady()` clears `overclockChargesRemaining` on fresh run — set charges to 2, ready up all players, assert charges are `0` after `checkAllReady()`.
- All tests pass with `pnpm test`.

## Technical Specs

- **`game/server/test/overclock.test.js`** (append to existing file):
  - Add a new `describe('Overclock run-end lifecycle', ...)` block using the **unit-test pattern** from `server.test.js` (not socket-based integration).
  - Import the needed functions at the top of the file:
    ```javascript
    import {
      checkRunTerminalState,
      returnPlayersToLobby,
      giveUpRun,
      checkAllReady,
      recordEnemyDefeated,
      startDungeonRun,
      resetTransientRunState,
      gameState,
      createGameState,
    } from '../index.js';
    import { setTestProvider, InMemoryProvider } from '../index.js';
    import { vi } from 'vitest';
    ```
  - Define local helpers (mirror `server.test.js` pattern):
    ```javascript
    function resetState() {
      Object.assign(gameState, createGameState());
    }
    function addPlayer(id, overrides = {}) {
      gameState.players[id] = {
        x: 0, y: 0.5, z: 0, rotation: 0, hp: 100, dead: false,
        lastActivity: Date.now(), ready: false, magicStones: 100,
        currency: 0, debugScenario: null, pendingSummons: new Set(),
        deck: [], overclockChargesRemaining: 0, ...overrides,
      };
    }
    function mockIoEmit() {
      const emitCalls = [];
      const orig = io.emit;
      io.emit = (event, data) => emitCalls.push({ event, data });
      return { emitCalls, restore: () => { io.emit = orig; } };
    }
    ```
  - Use `vi.useFakeTimers()` / `vi.useRealTimers()` around tests (same as `server.test.js`).
  - Tests:
    1. `"checkRunTerminalState clears overclockChargesRemaining on victory"` — `resetState()`, `startDungeonRun()`, `addPlayer('p1', { overclockChargesRemaining: 2 })`, add 1 enemy, `recordEnemyDefeated(1)`, `checkRunTerminalState()`, assert `gameState.players.p1.overclockChargesRemaining === 0`.
    2. `"checkRunTerminalState clears overclockChargesRemaining on failure"` — `resetState()`, `startDungeonRun()`, `addPlayer('p1', { hp: 0, dead: true, overclockChargesRemaining: 2 })`, `checkRunTerminalState()`, assert `gameState.players.p1.overclockChargesRemaining === 0`.
    3. `"returnPlayersToLobby clears overclockChargesRemaining"` — `resetState()`, `gameState._lobbyId = 'test-lobby'`, `startDungeonRun()`, `addPlayer('p1', { overclockChargesRemaining: 2 })`, mock io emit, `returnPlayersToLobby()`, restore, assert `gameState.players.p1.overclockChargesRemaining === 0`.
    4. `"giveUpRun clears overclockChargesRemaining"` — `resetState()`, `gameState._lobbyId = 'test-lobby'`, `gameState.gamePhase = 'playing'`, `startDungeonRun()`, `addPlayer('p1', { overclockChargesRemaining: 2 })`, mock io emit, `giveUpRun()`, restore, assert `gameState.players.p1.overclockChargesRemaining === 0`.
    5. `"checkAllReady clears overclockChargesRemaining on fresh run"` — `resetState()`, `gameState._lobbyId = 'test-lobby'`, `addPlayer('p1', { ready: true, overclockChargesRemaining: 2 })`, mock io emit, `checkAllReady()`, restore, assert `gameState.players.p1.overclockChargesRemaining === 0`.

## Verification: code
