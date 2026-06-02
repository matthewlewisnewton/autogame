# Server: Phase Step ally position swap

Implement the `phase_step` key item server-side: swap the caster's `x,y,z` with a
targeted ally (or the nearest ally in range when no target is given), within a 6m
range, on a ~12s cooldown. Include the dedicated test file covering the two
acceptance scenarios.

## Acceptance Criteria

- `KEY_ITEM_DEFS.phase_step` is redefined for swap semantics: `cooldownMs: 12000`,
  a range field of `6` (metres), and a `name`/`description` reflecting "swap
  positions with an ally". No other key item def is changed.
- `phase_step` is added to the implemented whitelist in the `useKeyItem` handler so
  it no longer returns `not_implemented`.
- `useKeyItem` for `phase_step` accepts an optional `targetPlayerId` in the payload.
  When provided, the swap targets that player; when omitted, the server picks the
  nearest living, non-extracted ally (a different player in the same run) within
  the 6m range.
- A successful swap exchanges the caster's and ally's `x`, `y`, and `z` so the two
  players trade positions. Both endpoints are validated as inside the dungeon
  before the swap; if either endpoint is invalid the swap fails gracefully with a
  reason and does NOT burn the cooldown.
- Solo case (no other eligible ally in the run) fails gracefully with a clear
  reason (e.g. `no_ally`) and does NOT burn the cooldown.
- Out-of-range case (the chosen/nearest ally is farther than 6m) fails gracefully
  with a reason (e.g. `out_of_range`) and does NOT burn the cooldown.
- On success the cooldown is set (`player.keyItemCooldownUntil = now + cooldownMs`),
  `keyItemUsed` is emitted with `ok: true`, the swapped `targetPlayerId`, and the
  new caster coords, and a `stateUpdate` snapshot is broadcast to the lobby.
- A new `game/server/test/phase_step.test.js` exists and passes, covering at least:
  (a) two players within range swap coordinates, and (b) an out-of-range attempt
  fails without swapping. `pnpm test` (server) passes with no regressions.

## Technical Specs

- `game/server/progression.js`: replace the placeholder `phase_step` entry in
  `KEY_ITEM_DEFS` (currently `type: 'teleport', maxDistance: 8`) with the swap
  definition described above (`cooldownMs: 12000`, `range: 6`). `KEY_ITEM_DEFS` is
  already exported and imported by `index.js`.
- `game/server/index.js`, `socket.on('useKeyItem', ...)` handler (~line 2512):
  - Add `'phase_step'` to the implemented-items guard (~line 2544).
  - Add a `if (keyItemId === 'phase_step') { ... }` branch (place it alongside the
    other per-item branches, before the trailing `dodge_roll` block). Read
    `data.targetPlayerId` (string or null). Build the candidate ally list from
    `Object.values(state.players)` excluding the caster and any `dead`/`extracted`
    players. If `targetPlayerId` is given, select that player from the list; else
    pick the candidate with the smallest `Math.hypot(p.x - player.x, p.z - player.z)`.
    Fail with `no_ally` if the list is empty (or the named target is gone), and
    `out_of_range` if the chosen ally's distance exceeds `def.range`.
  - Validate both positions with the existing `isInsideDungeon(x, z)` helper (used
    by the `summon_recall` branch); fail gracefully (`invalid_position`) without
    cooldown if either is invalid.
  - Swap `x`, `y`, `z` between caster and ally. Set `persistenceDirty = true` on
    both, set the caster's `keyItemCooldownUntil`, emit `keyItemUsed` with
    `{ ok: true, keyItemId, targetPlayerId: <ally id>, x, y, z, cooldownUntil }`,
    then `io.to(lobby.id).emit('stateUpdate', stateSnapshot())`.
  - On every soft-fail, emit `keyItemUsed` with `{ ok: false, reason }` and `return`
    BEFORE touching the cooldown (mirror the `summon_recall` `no_minions` pattern).
- `game/server/test/phase_step.test.js`: new file modelled on the existing
  `game/server/test/dodge_roll.test.js` / `guard_block.test.js` socket-integration
  style. Cover the two-player swap, out-of-range failure, and solo `no_ally` cases.

## Verification: code
