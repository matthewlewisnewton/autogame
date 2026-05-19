# Replace shallow-copy stateSnapshot with explicit public snapshot builder

`game/server/index.js` uses a shallow copy of `gameState` for `stateUpdate` events, only deleting `layout`. Internal fields like `_victoryCounters` and non-serializable per-player fields like `pendingSummons` (a `Set`) leak into the JSON broadcast.

Replace the shallow copy with an explicit builder that constructs a clean public snapshot — only the fields the client actually consumes.

## Acceptance Criteria

- `stateSnapshot()` returns an object containing only client-relevant fields: `players` (with public sub-fields), `enemies`, `minions`, `loot`, `gamePhase`, `run`, `bounds`, `layoutSeed`, `currency`, `lobby`.
- `layout` is never included in the returned snapshot.
- `_victoryCounters` is never included.
- `pendingSummons` (or any `Set`/non-serializable field) is stripped from player objects.
- All existing client-facing fields the UI depends on are preserved (position, hp, deck, hand, magicStones, etc.).
- A new server unit or integration test asserts that `stateSnapshot()` (or a captured `stateUpdate` payload) does not contain `layout`, `_victoryCounters`, or `pendingSummons`.

## Technical Specs

- **File**: `game/server/index.js` — rewrite `stateSnapshot()` (line ~855) to explicitly build the public object instead of `{ ...gameState }`.
- **File**: `game/server/test/server.test.js` or `game/server/test/integration.test.js` — add a test that calls `stateSnapshot()` or captures a `stateUpdate` emit and asserts internal fields are absent.

## Verification: code
