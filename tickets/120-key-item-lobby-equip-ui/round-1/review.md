# Senior review: 120-key-item-lobby-equip-ui

**Baseline:** `2d052464f6d2a5aa2431afde2bbf370f8ed2622e`  
**Commits:** `f59ebb6` → `4eb4810` (4 sub-tickets: server init defs, HTML/CSS panel, client render/equip, unit tests)

## Runtime health

| Check | Result |
|-------|--------|
| `metrics.json` present, `"ok": true` | Pass |
| `pageerrors` | Empty |
| `failure_kind` | Absent |
| `console.log` | No `pageerror` or `[fatal]` lines; only Vite connect, scene init, and benign HTTP 409 on auth (duplicate register) |

The captured run proves the game starts, connects, and reaches gameplay without browser exceptions.

**Capture note:** `capturePlanSource` is `fallback` (generic lobby → ready → movement smoke). Screenshots show squad lobby and in-dungeon play only — not the Key Items tab. That limits visual proof of this ticket but does not indicate a broken build.

## Per-criterion findings

### Lobby UI lists unlocked key items from `KEY_ITEM_DEFS` (14 ids; scroll if needed)

**Met.** Server sends the full `KEY_ITEM_DEFS` object on `init` (`game/server/index.js`). Client stores it in `keyItemDefs` and `renderKeyItemList()` builds one entry per `Object.values(keyItemDefs)`. `progression.js` defines exactly 14 items; `isKeyItemUnlocked` currently treats all defs as unlocked (matches ticket 118). `#key-item-list` uses `max-height: 360px; overflow-y: auto` for scrolling.

### Selected item highlighted; click calls `equipKeyItem` and updates on success

**Met.** Equipped row gets class `equipped` and `aria-pressed="true"`. Click / Enter / Space calls `socket.emit('equipKeyItem', { keyItemId })`. `keyItemEquipped` updates `gameState.players[myId].equippedKeyItemId` and re-renders. Server handler validates lobby phase, persists via `savePlayerData`, and emits `keyItemEquipped`.

### Selection persists across lobby ↔ auth refresh (server source of truth)

**Met.** Equip writes `player.equippedKeyItemId` and `savePlayerData`. Persistence tests in `game/server/test/key-items.test.js` cover extract/restore. Live snapshots include `equippedKeyItemId` (`buildClientSnapshot` in `progression.js`). Reconnect: `init` loads `keyItemDefs`; `lobbyJoined` / `stateUpdate` restore `gameState` with server `equippedKeyItemId`; opening the Key Items tab reads that field in `renderKeyItemList()`.

### Shows name, short description, base cooldown from defs

**Met.** Each entry renders `def.name`, `def.description`, and ``${(def.cooldownMs / 1000).toFixed(1)}s cooldown``. Panel hint explains single-slot / cooldown behavior.

### Empty / error states (disconnect, equip rejected)

**Met.** Empty defs: “No key items available.” Disconnected socket on click: “Not connected to server.” `keyItemError` maps `not_in_lobby`, `missing_key_item_id`, `unknown_item` to user-facing copy in `#key-item-error`. Covered by unit test.

### Equip only in lobby — not a full dungeon HUD editor

**Met.** UI lives under `#lobby` inside `#key-item-loadout`, shown only when `activeLobbyTab === 'keyitems'`. During `playing`, `#lobby` is hidden (`showGameLobby` / gameplay paths); no in-run equip surface was added.

### Tests: DOM list + equip emit / selection helpers

**Met.** `describe('Key Items equip UI')` in `game/client/test/main.test.js` — 5 tests (list length, `.equipped`, click emit, `keyItemEquipped` re-render, `keyItemError` display). All pass locally. Server equip/persistence covered in `game/server/test/key-items.test.js` (ticket 118, still valid).

### Accessible labels and keyboard focus

**Met.** Entries use `role="button"`, `tabindex="0"`, `aria-label` (“Equip … (equipped)”), `aria-pressed`, and Enter/Space handlers. Tab button is a native `<button type="button">`.

## Design and foundation

- Aligns with lobby tab pattern (`deck-editor`, medic, forge) in `index.html` / `setLobbyTab` / `main.js`.
- No new debug scenarios; normal equip path uses server-validated `equipKeyItem` in lobby phase only.
- `game/docs/requirements.md` foundation unchanged (3D render, sockets, multiplayer, movement).
- `game/docs/controls.md` key-item use binding is separate from this lobby equip UI (ticket 119 territory).

## Code quality

- Focused diff (~540 lines) across server init, HTML, CSS, `renderKeyItemList`, socket handlers, tests.
- No dead module (`key-item-loadout.js` optional path — logic kept in `main.js` per existing lobby style).
- Handlers mirror medic/shop error patterns.

## Remaining gaps

None blocking. Runtime is clean and acceptance criteria are satisfied in the working tree.

## Nits (non-blocking)

See `nits.md` for follow-ups: extend lobby tab integration test to Key Items, and improve harness capture of the Key Items panel.

VERDICT: PASS
