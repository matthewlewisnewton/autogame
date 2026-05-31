# Key Item Data Model and Persistence

Introduce the **key item** system foundation: one utility item per player, separate
from the card hand, with server-authoritative definitions and persistence.

## Difficulty: medium

## Goal

Define key items in shared server data, store each player's equipped key item
and cooldown state, and expose socket/API hooks for equip and use (handlers can
be stubs until ticket 121).

## Problem

There is no concept of a non-card utility action. Card slots and cooldowns
(`slotCooldowns`) are unrelated to dodge-roll or future gadgets.

## Acceptance Criteria

- `KEY_ITEM_DEFS` registers **all** key items (unlocked at start); each entry has
  `id`, `name`, `description`, `cooldownMs`, and type-specific fields. IDs:
  `dodge_roll`, `summon_recall`, `field_medic_kit`, `guard_block`, `flare_beacon`,
  `loot_magnet`, `overclock`, `smoke_bomb`, `ground_anchor`, `phase_step`,
  `purge_charm`, `echo_strike`, `barrier_dome`, `rally_cry`. Only `dodge_roll`
  must be fully usable in this ticket; others may `useKeyItem` → `{ ok: false,
  reason: 'not_implemented' }` until their content tickets land.
- Player / account state includes:
  - `equippedKeyItemId` (nullable string, default `dodge_roll` for new players)
  - `keyItemCooldownUntil` (timestamp ms, 0 when ready)
  - optional `invulnerableUntil` or tick counter for i-frames (ticket 121 may
    finalize usage)
- **All key items unlocked at start** — only `dodge_roll` exists, but list/query
  API returns every defined item as unlocked (no grind gate in this ticket).
- Persistence: equipped key item survives disconnect/reconnect (account settings
  or player record — follow existing patterns in `settings.js` / `persistence.js`).
- Socket events (names can match project style):
  - `equipKeyItem` { keyItemId } — lobby-safe, validates id, broadcasts to self
  - `useKeyItem` — accepted only in active dungeon run; rejects when on cooldown
    (121 implements motion; here it may no-op or return structured errors)
- Public state snapshot exposes equipped key item id and cooldown remaining (ms)
  for HUD (client UI in later tickets).
- Tests: equip persists; use rejected when cooldown active; unknown id rejected.

## Implementation Notes

- Do **not** build lobby UI or input bindings in this ticket (119–120).
- Do **not** implement dash physics here unless needed for a minimal `useKeyItem`
  stub test — full dodge in **121**.
- Mirror card-def patterns in `progression.js` / `index.js` for consistency.
- Key files: `game/server/progression.js`, `game/server/index.js`,
  `game/server/persistence.js`, `game/server/settings.js` (if equip belongs in
  account settings).

## Verification

- `Verification: code`

## Dependencies

None (first in the key-item chain).
