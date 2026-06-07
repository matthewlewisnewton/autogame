# 06 — Persist HP and magic stones across cold save/load

Player `hp`, `dead`, and `magicStones` must survive process restarts, lobby deletion/rejoin, and any cold load from the persistence provider — not just in-memory telepipe transitions. Extend the existing persistence layer so vitals are written with currency/inventory and restored when `buildPlayerRecord` constructs a player from saved data.

## Acceptance Criteria

- `extractPersistentData()` includes `hp`, `dead`, and `magicStones` in the returned object.
- `buildPlayerRecord()` restores `hp`, `dead`, and `magicStones` from `savedData` when present; brand-new accounts still get `MAX_HP`, `dead: false`, and `STARTING_MAGIC_STONES`.
- `joinPlayerToLobby()` / reconnect paths do not overwrite restored vitals with defaults.
- Cold-load test: save a player with `hp: 42`, `magicStones: 15`, reload via provider → values match (within MS passive-regen tolerance if applicable).
- Cold-load test: `dead: true` with low HP persists across save/load until med booth or explicit heal.
- Existing persistence tests in `persistence.test.js` updated; no regressions in `pnpm test:quick` server suite.

## Technical Specs

- **`game/server/progression.js`** — Add `hp`, `dead`, and `magicStones` to `extractPersistentData()` (~line 854). Ensure `savePlayerData()` persists them on disconnect, medic heal, and other existing save triggers.
- **`game/server/index.js`** — In `buildPlayerRecord()` (~line 895), restore `hp`, `dead`, and `magicStones` from `savedData` with the same null/undefined gating used for currency and deck fields.
- **`game/server/test/persistence.test.js`** — Extend `extractPersistentData` describe block to assert vitals round-trip.
- **`game/server/test/server.test.js`** — Add cold-load or provider-restore test for damaged HP and spent magic stones.
- **`game/server/test/integration.test.js`** — Optional end-to-end: disconnect/reconnect or simulated provider reload preserves vitals.

## Verification: code
