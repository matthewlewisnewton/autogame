# Rally Cry: party move-speed buff

Implement the `rally_cry` key item: when used in a dungeon, it grants a short
party-wide move-speed buff to every living player within radius (including the
caster). No heal. The buff expires automatically and refreshing it does not
stack with itself.

## Acceptance Criteria

- `rally_cry` is a fully-implemented key item: using it in a dungeon returns
  `keyItemUsed { ok: true }` (no longer `not_implemented`).
- Using `rally_cry` sets `rallyUntil` (timestamp) and `rallySpeedMultiplier`
  (~1.1) on the caster AND every other living, non-extracted player whose
  horizontal distance from the caster is within the item's `radius` (~8m).
  Players outside the radius are unaffected.
- While `now < player.rallyUntil`, that player's per-tick movement step in
  `applyPlayerMovement` is multiplied by `rallySpeedMultiplier` (≈ +10% speed),
  so two players in radius cover more ground per tick than an un-buffed player
  over the same input.
- The buff lasts ~4s (`durationMs` 4000): once `now >= rallyUntil` the player's
  movement step returns to normal.
- No-stack-with-itself: re-using `rally_cry` while a buff is already active
  re-applies the same multiplier (it does not multiply/compound the existing
  one). The effective multiplier stays ~1.1, never ~1.21.
- No HP/heal effect is applied by `rally_cry`.
- Cooldown is ~10s: after use, `keyItemCooldownUntil ≈ now + 10000`, and a
  second use before cooldown elapses returns `{ ok: false, reason: 'on_cooldown' }`.
- The guard_block slow (×0.2) and the rally buff both resolve sanely when both
  are present (rally does not cancel the guard_block branch logic).
- New/updated tests in `game/server/test/` cover: (a) two players in radius get
  a larger move delta than the un-buffed baseline, (b) the buff expires after
  4s (movement returns to baseline), (c) a player outside `radius` is not
  buffed, (d) cooldown blocks a second immediate use.

## Technical Specs

- `game/server/progression.js`: update the existing `rally_cry` entry in
  `KEY_ITEM_DEFS` to match the ticket — `cooldownMs: 10000`, `durationMs: 4000`,
  `radius: 8`, add `speedMultiplier: 1.1`, and REMOVE the heal fields
  (`hpRegenPerTick`, `tickIntervalMs`). Keep `type: 'support'`.
- `game/server/index.js`: in the `useKeyItem` handler, remove `rally_cry` from
  the `not_implemented` guard list (~line 2833) and add a `rally_cry` branch
  (alongside the other key-item branches). The branch must:
  - compute `radius`/`durationMs`/`speedMultiplier` from `def` with sensible
    fallbacks,
  - collect the caster plus all living, non-extracted players in the same run
    within horizontal `radius` (use `Math.hypot(p.x - player.x, p.z - player.z)`),
  - set `rallyUntil = now + durationMs` and `rallySpeedMultiplier = multiplier`
    on each affected player (assignment, not multiplication — no self-stack),
  - set `player.keyItemCooldownUntil = now + (def.cooldownMs || 10000)`,
  - mark affected players `persistenceDirty = true`,
  - `socket.emit('keyItemUsed', { ok: true, keyItemId, rallyUntil, cooldownUntil, affected })`
    and broadcast `io.to(lobby.id).emit('stateUpdate', stateSnapshot())`.
- `game/server/simulation.js`: in `applyPlayerMovement`, after computing
  `playerStep`, apply the rally multiplier when active, e.g.
  `if (now < (player.rallyUntil || 0)) playerStep *= (player.rallySpeedMultiplier || 1);`
  Make `playerStep` a `let` if needed and keep the existing guard_block factor.
- Initialize `rallyUntil`/`rallySpeedMultiplier` defaults (0 / 1) wherever other
  per-player key-item runtime fields are reset (e.g. createPlayer / run reset /
  the `overclockChargesRemaining = 0` reset sites in index.js) so stale buffs
  never carry across runs.
- Follow the patterns of the existing `overclock` and `guard_block` branches.

## Verification: code
