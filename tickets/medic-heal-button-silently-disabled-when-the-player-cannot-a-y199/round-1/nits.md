## Medic HUD live refresh on wallet change

When the Medic tab is already open, a `stateUpdate` that only changes `currency` may not call `renderGuildMedic()` because `returnToGuildLobby` re-invokes `syncLocalCollectionState` after it was already synced in `stateHandlers.js`, so the inner guard returns false. Shortfall copy can stay stale until the player switches tabs or heals. Consider calling `renderGuildMedic()` whenever `collectionChanged` is true and `activeLobbyTab === 'medic'`, without the second `syncLocalCollectionState` guard.

### Acceptance Criteria
- With Medic tab open and HP &lt; MAX, receiving enough money via trade or `stateUpdate` updates `#medic-cost-display` from shortfall to paid copy without leaving the tab.

## Partial-wallet shortfall test coverage

`medicHud.test.js` covers broke (0) and fully affordable (≥10) cases but not a partial shortfall (e.g. HP 50, money 5). A single test would lock in the `you have 5` branch of the cost line.

### Acceptance Criteria
- Test asserts `#medic-cost-display` is `Need 10 money — you have 5. Free triage available.` when `currency` is 5 and `hp` is below MAX.

## Top-level harness capture omits Medic tab

Round-1 and sub-ticket captures used the generic fallback smoke plan (dungeon deploy/movement). No screenshot proves the Medic shortfall UI in-browser at the ticket level, though unit tests cover it.

### Acceptance Criteria
- Harness capture plan for medic-affordability tickets includes opening the Medic tab with a broke injured player and screenshots `#medic-cost-display` text.
