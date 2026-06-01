## useKeyItem silent failure when dead or extracted

`useKeyItem` returns without emitting `keyItemUsed` when the player is dead or extracted (`index.js`), unlike other rejection paths that return structured errors. Callers may hang waiting for a response.

### Acceptance Criteria

- Emit `keyItemUsed` with `{ ok: false, reason: 'dead' }` or `{ ok: false, reason: 'extracted' }` instead of returning silently.
- Add a unit test covering each case during an active run.

## Client-facing list key items socket (optional pre-119)

`getUnlockedKeyItems()` exists server-side but clients cannot query definitions without importing server code. Ticket 119 lobby UI will need id/name/description/cooldown for all 14 items.

### Acceptance Criteria

- Add a lobby-safe socket handler (e.g. `listKeyItems`) that returns `{ items: getUnlockedKeyItems().map(...) }` with no grind flags (all unlocked).
- Handler is read-only and does not mutate player state.

## key-item-cooldown debug scenario test

`key-item-cooldown` was added to `DEBUG_SCENARIOS` for QA but has no automated coverage.

### Acceptance Criteria

- Integration or socket test applies `debugScenario: 'key-item-cooldown'` (with `ALLOW_DEBUG_SCENARIOS=1`) and asserts `gamePhase === 'playing'` and `keyItemCooldownUntil > Date.now()` on the player snapshot.
