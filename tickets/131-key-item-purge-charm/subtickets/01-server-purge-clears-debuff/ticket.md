# Purge Charm — clear oldest debuff

Implement a minimal player debuff system and wire `useKeyItem('purge_charm')` to
remove the single oldest active debuff from the casting player. Set the cooldown
to ~7s and add `purge_charm` to the implemented-key-item allow-list.

## Acceptance Criteria

- `purge_charm` cooldown is ~7s (`cooldownMs: 7000`), not 20000.
- Every player has a `debuffs` array, initialized to `[]` on creation, and it is
  never undefined when `useKeyItem` runs.
- A minimal way to apply a debuff exists (an exported `addDebuff(player, type, expiresAt)`
  helper, or equivalent) so tests can put a debuff on a player; debuffs carry at
  least a `type` field (e.g. `'slow'`, `'burn'`) and are stored in insertion
  (oldest-first) order.
- `useKeyItem` with `keyItemId: 'purge_charm'` is no longer rejected as
  `not_implemented`.
- When the casting player has one or more debuffs, using `purge_charm` removes
  exactly the OLDEST debuff (the first element), leaves any remaining debuffs
  intact, burns the 7s cooldown (`player.keyItemCooldownUntil`), and emits
  `keyItemUsed` with `ok: true`.
- On-cooldown reuse is rejected with `keyItemUsed { ok: false, reason: 'on_cooldown' }`
  (existing shared cooldown gate is sufficient).
- Tests in `game/server/test/` cover: a player with two debuffs uses `purge_charm`
  → only the oldest is removed and the newer one remains; cooldown is set to ~7s.

## Technical Specs

- `game/server/progression.js`: change `purge_charm.cooldownMs` from `20000` to `7000`.
- `game/server/index.js`:
  - Add `debuffs: []` to the player object created in the connection/init block
    (near `keyItemCooldownUntil`, ~line 934); also defensively default
    `if (!Array.isArray(player.debuffs)) player.debuffs = [];` where other late
    defaults are applied (~line 1041).
  - Add `'purge_charm'` to the implemented-key-item allow-list (~line 2591) so it
    is not rejected as `not_implemented`.
  - Add a `if (keyItemId === 'purge_charm') { ... }` branch in the `useKeyItem`
    handler (alongside the other branches, ~line 2636). When `player.debuffs.length > 0`,
    `player.debuffs.shift()` to drop the oldest, set
    `player.keyItemCooldownUntil = now + (def.cooldownMs || 7000)`, mark
    `player.persistenceDirty = true`, emit `keyItemUsed { ok: true, keyItemId, cleared: <type>, cooldownUntil }`,
    and broadcast `stateUpdate`. (The no-debuff fallback is handled in sub-ticket 02 —
    for now, if there are no debuffs, this branch may simply burn cooldown and emit
    `ok: true` with `cleared: null`; do NOT grant a shield here.)
- `game/server/simulation.js`: add and export a minimal `addDebuff(player, type, expiresAt)`
  helper (pushes `{ type, expiresAt }` onto `player.debuffs`) so a test debuff path
  exists. Keep it minimal; no per-tick debuff effects required for this sub-ticket.

## Verification: code
