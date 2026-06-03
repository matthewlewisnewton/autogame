# useKeyItem: emit errors when dead or extracted

The `useKeyItem` handler in `game/server/index.js` returns silently when the player is dead or extracted, so clients waiting on `keyItemUsed` never get a response. Match other rejection paths by emitting structured `{ ok: false, reason }` payloads and cover both cases with socket tests during an active run.

## Acceptance Criteria

- When `gamePhase === 'playing'` and the caller is dead, `useKeyItem` emits `keyItemUsed` with `{ ok: false, reason: 'dead' }` and does not apply the key item.
- When `gamePhase === 'playing'` and the caller is extracted, `useKeyItem` emits `keyItemUsed` with `{ ok: false, reason: 'extracted' }` and does not apply the key item.
- A unit/socket test asserts the dead case (player in run, `player.dead = true`, emit `useKeyItem`, await `keyItemUsed`).
- A unit/socket test asserts the extracted case (player in run, `player.extracted = true`, emit `useKeyItem`, await `keyItemUsed`).

## Technical Specs

- **`game/server/index.js`** — In the `socket.on('useKeyItem', …)` handler (~line 2797), replace `if (!player || player.dead || player.extracted) return;` with explicit checks: missing player may still return silently (or match existing patterns); for `player.dead` emit `{ ok: false, reason: 'dead' }`; for `player.extracted` emit `{ ok: false, reason: 'extracted' }`. Keep the `gamePhase !== 'playing'` guard unchanged.
- **`game/server/test/key-items.test.js`** — In the existing `describe('useKeyItem socket handler', …)` block (uses `connectAndStartRun()`), add two tests that set `player.dead` or `player.extracted` via `playerForSocket(socket)` before emitting `useKeyItem` with a valid id (e.g. `dodge_roll`), then assert the `keyItemUsed` payload. Re-check file paths if the harness reports staleness.

## Verification: code
