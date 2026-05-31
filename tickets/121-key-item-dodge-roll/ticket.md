# Key Item: Dodge Roll

Implement the first key item — **dodge roll**: a fast burst in the current movement
direction with **one server tick of invulnerability** and a **moderate cooldown**.

## Difficulty: medium

## Goal

When the player uses their equipped key item (`dodge_roll`), the server applies
an authoritative dash, grants brief i-frames, enforces cooldown, and the client
shows clear feedback.

## Problem

`useKeyItem` is a stub after 118–119. Players need a responsive dodge that cannot
be spammed and that respects walls/slopes.

## Acceptance Criteria

- Using `dodge_roll` while on cooldown fails with a clear error/event (no dash).
- On success:
  - Player moves quickly (~2–3× normal move speed) over a short distance in the
    **current input direction** (keyboard/gamepad movement vector at use time;
    if stationary, use last facing / `rotation` yaw).
  - **One simulation tick** of invulnerability: player does not take damage from
    enemy hits that tick (document how `invulnerableUntil` or tick flag interacts
    with existing damage handlers).
  - `keyItemCooldownUntil` set to `now + cooldownMs` from defs (moderate — not
    spammable; tune in `KEY_ITEM_DEFS`).
- Dash stops at walls using existing collision helpers (`tryPlayerMove` /
  `resolveWallCollision` / `isInsideDungeon`); no clipping through walls.
- On sloped floors (if 117 landed), `y` follows `sampleFloorY` after the dash.
- Client: short VFX (motion trail, brief squash, or camera nudge) + UI cooldown
  indicator on the key item HUD element (reuse hint from 119).
- Server broadcasts dash to other clients (position snap or short lerp acceptable).
- Tests:
  - Unit: cooldown gate, i-frame blocks one damage application.
  - Integration: socket `useKeyItem` moves player, sets cooldown, second use fails.
- `game/docs/controls.md` documents dodge roll behavior and cooldown.

## Implementation Notes

- Depends on:
  - [118-key-item-data-and-persistence](tickets/118-key-item-data-and-persistence/)
  - [119-key-item-input-bindings-and-settings](tickets/119-key-item-input-bindings-and-settings/)
  - [120-key-item-lobby-equip-ui](tickets/120-key-item-lobby-equip-ui/) (equip
    `dodge_roll` before testing in lobby)
- Optional: if [117-sloped-movement-server-and-client](tickets/117-sloped-movement-server-and-client/)
  is not done, dash still works on flat `y` — do not block on 117.
- Invuln: prefer a single flag checked in the damage pipeline rather than ad-hoc
  skips in every enemy attack.
- Key files: `game/server/index.js`, `game/server/simulation.js`,
  `game/client/main.js`, `game/client/input.js` (wire `onUseKeyItem` if not done).

## Verification

- `Verification: code` — tests above.
- `Verification: visual` — short dodge visible in dungeon with cooldown UI.

## Dependencies

- [118-key-item-data-and-persistence](tickets/118-key-item-data-and-persistence/)
- [119-key-item-input-bindings-and-settings](tickets/119-key-item-input-bindings-and-settings/)
- [120-key-item-lobby-equip-ui](tickets/120-key-item-lobby-equip-ui/)
