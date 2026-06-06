# Persist HP and Magic Stones in saved player records

Player health and Magic Stones must survive cold reconnect, eviction reload, and process restart — not only the in-memory telepipe round trip. Wire `hp` and `magicStones` through the persistence extract/restore path so `buildPlayerRecord()` and saved-data refresh no longer re-seed `MAX_HP` / `STARTING_MAGIC_STONES` over stored values.

## Acceptance Criteria

- `extractPersistentData()` includes `hp` and `magicStones` in the serialized blob (alongside currency, inventory, location, etc.).
- `buildPlayerRecord()` restores `hp` and `magicStones` from `savedData` when present; brand-new players (no saved data) still get `MAX_HP` and `STARTING_MAGIC_STONES`.
- The saved-data refresh branch in `joinPlayerToLobby()` (~1128) also applies restored `hp` / `magicStones` when reloading persisted fields.
- `savePlayerData()` / round-trip load preserves partial values (e.g. `hp: 40`, `magicStones: 15`).
- Cold reconnect after eviction preserves spent Magic Stones and partial HP instead of refilling to defaults.
- Cold reconnect does **not** silently full-heal a dead or wounded player; Medic booth remains the only HP-restore path (align with sub-ticket 04 policy).
- Updated tests:
  - `persistence.test.js` — extract/save/load round-trip asserts `hp` and `magicStones`; remove or invert the test that asserts they are excluded.
  - `integration.test.js` — `resets slotCooldowns and magicStones on active-run reconnect` expects preserved MS, not `STARTING_MAGIC_STONES`; dead-player reconnect test expects preserved HP/dead state, not `MAX_HP`.
  - Add focused reconnect test: partial HP + low MS → save → evict → reconnect → same HP/MS.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **`game/server/progression.js`**
  - **`extractPersistentData()` (~855):** add `hp: player.hp ?? MAX_HP` and `magicStones: player.magicStones ?? STARTING_MAGIC_STONES` to the returned object. Import/use `MAX_HP` and `STARTING_MAGIC_STONES` from config if not already in scope.
  - Ensure any caller that writes persistence (e.g. `savePlayerData`, medic heal save) automatically picks up the new fields — no separate save path changes expected beyond extract.

- **`game/server/index.js`**
  - **`buildPlayerRecord()` (~886):** in the `if (savedData)` block (~943), restore `player.hp = savedData.hp ?? player.hp` and `player.magicStones = savedData.magicStones ?? player.magicStones`. Clamp `hp` to `[0, MAX_HP]` if needed; do not force `dead = false` when restoring partial HP.
  - **`joinPlayerToLobby()` saved-data refresh (~1128):** mirror the same `hp` / `magicStones` restore when refreshing an existing player record from disk.

- **`game/server/test/persistence.test.js`**
  - Update `expectPersistentData` helper or add hp/ms expectations.
  - Replace `does not include transient fields (hp, dead, ready, hand, deck)` with a test that **does** include `hp` and `magicStones` while still excluding run-transient fields (`hand`, `deck`, `ready`, etc.).
  - Update `saves only persistent fields` test to expect `hp` and `magicStones` in loaded data.

- **`game/server/test/integration.test.js`**
  - Update reconnect tests noted above (~5062, ~5069) to assert preservation per owner decision.

- **`game/server/test/server.test.js`** — add or extend a unit test for `buildPlayerRecord` with saved partial HP/MS if not covered elsewhere.

## Verification: code
