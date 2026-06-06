# Senior Review: 301-burning-and-slow-mutually-exclusive

## Per-Criterion Findings

### Runtime health
PASS. The captured run in `metrics.json` reports `ok: true`, reaches gameplay with two connected players, has `pageerrors: []`, and does not report a harness failure. `console.log` contains only Vite connection messages, scene initialization, and booth ready-up logs; there are no `pageerror` or `[fatal]` entries from game code.

### Burning and slow are mutually exclusive on any entity
PASS. `applySlow()` now clears `burningUntil` and resets `lastBurnTickAt` before applying slow, while `applyBurning()` clears `slowedUntil` before applying burn. Because these helpers operate on generic entities and are the shared status entry points, both player and enemy sources inherit the most-recent-wins behavior.

### Both application orders are covered for players and enemies
PASS. `server/test/burn_slow_mutual_exclusion.test.js` covers slowed-then-burned, burned-then-slowed, repeated toggles, and "never both" assertions for player-shaped and enemy-shaped entities. It also covers the burn tick clock reset when slow douses burn. The captured coverage log shows the new test file passed as part of the server suite, with 24 test files and 966 tests passing.

### Client shows only the active status
PASS. The client slow and burn indicators are separately driven by `slowedUntil` and `burningUntil` from the server snapshot. Since the server now zeroes the opposing timestamp on every status application, the existing renderer path disposes the inactive marker and displays only the current effect for local players, remote players, and enemies.

### Design and foundation consistency
PASS. The change is consistent with the combat status model in `game/docs/design.md`: it keeps the existing card-combat/status-effect architecture and does not alter the lobby, dungeon, rendering, networking, or movement foundations in `game/docs/requirements.md`. The captured run still demonstrates 3D rendering, client/server connectivity, multiplayer presence, and movement.

### Debug scenarios
PASS. This ticket did not add or change any `debugScenario` shortcut. The captured scenarios list is empty, so there is no debug-only path to validate for this ticket.

## Remaining gaps

None.

VERDICT: PASS
