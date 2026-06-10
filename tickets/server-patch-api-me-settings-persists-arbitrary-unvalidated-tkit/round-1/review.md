# Review: Server PATCH /api/me/settings Validation

## Per-Criterion Findings

### Runtime Health

PASS. The round-1 capture proves the game starts and loads cleanly. `metrics.json` has `"ok": true`, no harness startup failure, and `pageerrors: []`. `console.log` contains Vite connection lines plus two 409 resource errors, but no `pageerror` or `[fatal]` entries from game code. The fallback capture reached lobby and gameplay with canvas, socket connectivity, two players, movement, and dodge cooldown state visible.

### Settings PATCH Only Persists Whitelisted Keys With Validated Types

PASS. `game/server/settings.js` now routes all updates through `validateSettings()` before merge and persistence. The schema accepts only the known top-level setting fields (`soundEnabled`, `particlesEnabled`, `showHitboxes`, `lockOnRepeatAction`, `keyboard`, `gamepad`) and validates the currently shipped setting types and enum values. Gamepad and keyboard binding payloads are reconstructed into sanitized objects, so extra fields inside binding objects are not carried through.

### Unknown Keys Are Pruned

PASS. Unknown top-level PATCH fields are ignored before merge, and `backfillSettings()` prunes unknown or invalid stored fields on read/merge. This also protects legacy or manually tampered settings files from being served back verbatim through `GET /api/me`. Tests cover both PATCH pruning and manually written junk on disk.

### Stored Settings Size Is Capped

PASS. `updateSettings()` serializes the sanitized merged settings and rejects writes over `SETTINGS_MAX_BYTES` before touching the settings file. Existing oversized/tampered stored data is also prevented from being served as-is because `getSettings()` falls back to defaults if the backfilled settings would exceed the active cap. The cap is applied to accumulated stored JSON, not just the incoming request body.

### Tests Cover Rejection And Pruning

PASS. `coverage.log` shows the relevant test suite passed: 55 tests across 4 server files, including `server/test/settings.test.js` and `server/test/account.test.js`. The added tests exercise invalid types/enums, unknown key pruning, repeated junk PATCHes not increasing stored byte size, oversized write rejection without clobbering the prior file, and HTTP 400 behavior from `PATCH /api/me/settings`.

### Design And Foundation Consistency

PASS. The change is server-side account settings hardening and does not alter the core lobby, dungeon, combat, or rendering loop described in `game/docs/design.md`. The captured run still satisfies the foundation in `game/docs/requirements.md`: 3D scene renders, client connects to server, multiplayer presence is visible, and movement/dodge state updates during gameplay.

### Debug Scenarios

PASS. This ticket did not add or change a `?debugScenario=` shortcut. The capture used the fallback full-flow plan with `debugScenario: null`, so there is no new debug-only path to validate.

## Remaining gaps

None.

VERDICT: PASS
