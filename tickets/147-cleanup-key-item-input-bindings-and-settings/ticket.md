# Cleanup nits from 119-key-item-input-bindings-and-settings

> **Staleness note.** This follow-up ticket was written against commit
> `f7d0b1d` (2026-05-31). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `119-key-item-input-bindings-and-settings`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Profile-aware gamepad hint for key item binding

`getUseKeyItemBinding()` always labels the default gamepad button via `STANDARD_BUTTON_HINTS` (e.g. “DPad Down”), even when the active profile is 8BitDo 64 where index 13 is “Stick click” in `gamepad-profiles.js`. Settings UI and future HUD glyphs may mislabel the physical control for N64-layout players.

### Acceptance Criteria

- When profile is `8bitdo-64` (or auto-detected 8BitDo), `gamepadHint` uses that profile’s `buttonLabels` for the resolved index.
- Unit test covers 8BitDo profile hint text vs standard profile for the same default index.

## Pass equipped key item id on `useKeyItem` emit

`main.js` emits `socket.emit('useKeyItem')` with no payload; server 118 handler requires `{ keyItemId }` and responds `missing_key_item_id`. Input wiring is complete but the press does not yet exercise dodge/cooldown until the client sends the equipped id.

### Acceptance Criteria

- On `onUseKeyItem`, emit `{ keyItemId }` from the player’s equipped key item (or skip emit when none equipped).
- Manual or test: press `e` in dungeon with dodge equipped → `keyItemUsed` with `ok: true` or a defined rejection reason other than `missing_key_item_id`.
