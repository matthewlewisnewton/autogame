# Senior Review — Ticket 118: Key Item Data Model and Persistence

**Baseline:** `89153b480a2ff071b91c235ab8bcb59a0f47d757`  
**Commits:** 5 sub-tickets (`01`–`05`), `65c94d5` → `b98475b`  
**Changed files:** `game/server/progression.js`, `game/server/index.js`, `game/server/test/key-items.test.js`, `game/server/test/server.test.js` (snapshot assertion)

---

## Runtime health (capture)

| Check | Result |
|-------|--------|
| `metrics.json` present, `"ok": true` | Pass |
| `pageerrors` empty, no `failure_kind` | Pass |
| `console.log` — no `pageerror` / `[fatal]` from game code | Pass (benign Vite connect + HTTP 409 on duplicate register) |

The captured run reached lobby and active dungeon (`phase: playing`, canvas + hand visible). No harness infrastructure failure.

---

## Acceptance criteria

### `KEY_ITEM_DEFS` — all 14 items, required fields

**Met.** `game/server/progression.js` defines all ticket IDs with `id`, `name`, `description`, `cooldownMs`, and type-specific fields. `dodge_roll` includes movement/i-frame fields (`invincibleDurationMs`, `rollDistanceMs`, etc.). `getKeyItemDef()` returns `undefined` for unknown IDs. Unit test asserts length 14 and ID set.

### Player / account state fields

**Met.**

- `equippedKeyItemId` — default `'dodge_roll'` in `createPlayerProgress()`, `buildPlayerRecord()`, and restore paths (`savedData.equippedKeyItemId || 'dodge_roll'`).
- `keyItemCooldownUntil` — default `0`; initialized on join when missing.
- `invulnerableUntil` — not added; ticket marks this optional for ticket 121. Acceptable.

### All key items unlocked at start (list/query)

**Met (server helpers).** Sub-ticket decomposition scoped this to `getUnlockedKeyItems()` (returns all 14 defs) and `isKeyItemUnlocked(player, id)` (membership in `KEY_ITEM_DEFS`). No grind gate. There is no client-facing socket/HTTP list endpoint yet; the ticket explicitly defers lobby UI to 119–120, and defs are server-authoritative like `CARD_DEFS`. Future UI can call a new socket event or read defs from a dedicated payload when needed.

### Persistence across disconnect/reconnect

**Met.**

- `extractPersistentData()` includes `equippedKeyItemId`, defaults to `'dodge_roll'`, and omits `keyItemCooldownUntil` (run-transient).
- `equipKeyItem` calls `savePlayerData(socket.playerId)` after equip.
- `buildPlayerRecord` / `joinPlayerToLobby` restore `equippedKeyItemId` from saved data.

Tests cover `extractPersistentData` round-trip and socket equip mutates in-memory state. Full cold-reconnect integration for key items is not isolated in a dedicated test, but the wiring mirrors currency/deck persistence already covered in `persistence.test.js`.

### Socket events: `equipKeyItem` / `useKeyItem`

**Met.**

| Event | Behavior |
|-------|----------|
| `equipKeyItem` | Lobby-only (`not_in_lobby` otherwise); validates ID; `keyItemEquipped` to self; `savePlayerData` |
| `useKeyItem` | `playing` only (`not_in_dungeon`); cooldown → `on_cooldown` + `remainingMs`; unknown → `unknown_item`; non-`dodge_roll` → `not_implemented`; `dodge_roll` sets cooldown and `{ ok: true, cooldownUntil }`; emits `stateUpdate` on success |

`dodge_roll` use is a cooldown stub only (no motion/i-frames), per ticket 121 scope.

### Public state snapshot (HUD hooks)

**Met.** `stateSnapshot()` player entries include `equippedKeyItemId` and `keyItemCooldownRemaining` (`max(0, keyItemCooldownUntil - Date.now())`). Covered by `server.test.js` snapshot shape test. No client HUD in this ticket (expected).

### Tests

**Met.** `game/server/test/key-items.test.js` — 11 tests, all passing (re-run during review). Covers: 14 defs, persistence extract, equip socket, cooldown rejection, unknown IDs, dodge_roll cooldown set, `not_implemented` for other items.

---

## Design & regression

- **Scope discipline:** Server-only foundation; no lobby UI, input bindings, or dodge physics — aligned with ticket and `design.md` combat loop (cards remain separate from key items).
- **Patterns:** Mirrors `CARD_DEFS` / `extractPersistentData` / socket handler style in `index.js`.
- **Foundation:** No changes under `game/client/`; no regression to auth, lobby, or dungeon flow in capture.
- **Debug scenario `key-item-cooldown`:** Added to `DEBUG_SCENARIOS`; gated by `isDebugScenarioAllowed` / `debugScenario` socket (same as existing scenarios). Enters `playing` via `enterPlayingPhase`; cooldown state is also reachable by using `dodge_roll` in a normal run. Shortcut only sets player fields — does not bypass equip/use handlers for production paths.

---

## Code quality

- Handlers are focused; exports exposed for tests via `index.js` test surface.
- Minor inconsistency: `useKeyItem` returns silently when player is dead/extracted (no `keyItemUsed` error) — edge case, not acceptance-listed.
- `isKeyItemUnlocked(player, …)` ignores `player` (always true for defined IDs) — matches “all unlocked” but the parameter is unused until future progression.

---

## Capture vs. ticket intent

Gemini capture plan probed `equippedKeyItemId` and snapshot cooldown fields, but harness `harnessState` in `metrics.json` does not surface those fields — probes only show generic lobby/gameplay UI. **Server implementation and unit tests are the authoritative proof** for snapshot fields; screenshot shows healthy dungeon HUD without key-item UI (expected).

---

## Remaining gaps

None blocking. Runtime is clean; acceptance criteria are satisfied on the server foundation delivered by sub-tickets 01–05.

### Non-blocking nits (see `nits.md`)

- Silent `useKeyItem` when dead/extracted
- No client/socket “list key items” event yet (helpers exist server-side)
- `key-item-cooldown` debug scenario untested

---

VERDICT: PASS
