# Lobby-safe listKeyItems socket handler

`getUnlockedKeyItems()` exists server-side in `progression.js`, but clients cannot query key-item definitions without importing server code. Add a read-only socket handler so future lobby UI (ticket 119) can show id, name, description, and cooldown for all 14 items with no grind/unlock flags.

## Acceptance Criteria

- A socket event `listKeyItems` (client emit) is registered on authenticated connections.
- The server responds (e.g. `keyItemsListed`) with `{ items: [...] }` where each entry includes at least `id`, `name`, `description`, and `cooldownMs` (mapped from definitions).
- The list contains all 14 key items from `KEY_ITEM_DEFS` / `getUnlockedKeyItems()` with no per-player grind or lock flags (all treated as unlocked).
- The handler does not mutate lobby or player state (no writes to `equippedKeyItemId`, inventory, cooldowns, etc.).
- A socket test connects a client, emits `listKeyItems`, and asserts item count, known ids, and presence of the public fields.

## Technical Specs

- **`game/server/index.js`** — Add `socket.on('listKeyItems', …)` near other lobby-safe handlers (e.g. after `listLobbies` or beside `equipKeyItem`). Use `getUnlockedKeyItems()` (already imported) and map each def to a client-safe shape, e.g. `{ id, name, description, cooldownMs }` — omit internal-only fields if any. Emit a dedicated ack event such as `keyItemsListed` with `{ items }`. Require the player to be connected/in a lobby only if that matches neighboring handlers; do not require `gamePhase === 'playing'`.
- **`game/server/test/key-items.test.js`** (or a small new test file under `game/server/test/`) — Integration test: `connectClient`, emit `listKeyItems`, await response, expect 14 items and sample field values for `dodge_roll`.

## Verification: code
