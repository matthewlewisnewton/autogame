# Ground Anchor — knockback immunity + reduced move speed

Implement the `ground_anchor` key item: when used, the player becomes immune to
knockback/displacement for ~1.5s and their move speed is reduced to ×0.7 while
active, on a ~6s cooldown. Hook the immunity into a player-knockback code path
so a knockback applied during the anchor window is ignored, and applies normally
after it expires.

## Acceptance Criteria

- Using `ground_anchor` via the `useKeyItem` socket handler succeeds (no longer
  returns `not_implemented`): it sets `player.anchorUntil = now + ~1500ms`, burns
  the cooldown, and emits `keyItemUsed` with `{ ok: true, keyItemId: 'ground_anchor', anchorUntil, cooldownUntil }`.
- Cooldown is ~6s (`6000ms`): after a successful use, `player.keyItemCooldownUntil`
  is ~now+6000, and a second immediate use returns `{ ok: false, reason: 'on_cooldown' }`.
- While the anchor is active (`now < player.anchorUntil`), the player's per-tick
  movement step in the server simulation is multiplied by 0.7 (reduced speed);
  after `anchorUntil` passes, the step returns to normal. This stacks correctly
  with the existing `blockingUntil` / `rallyUntil` modifiers (does not overwrite them).
- A player-knockback helper exists that displaces a player by a direction/strength,
  but is a no-op (player position unchanged) when `now < player.anchorUntil`.
- Tests: a knockback applied to an anchored player is ignored (position unchanged);
  the same knockback applied after `anchorUntil` expires moves the player normally.
- The existing test asserting `ground_anchor` returns `not_implemented` is updated
  to reflect the new implemented behavior (no stale failing test).
- New `player.anchorUntil` field is initialized to `0` wherever players are created
  / reset alongside the other key-item fields, so it is always defined.

## Technical Specs

- `game/server/progression.js`: in the `ground_anchor` entry of `KEY_ITEM_DEFS`,
  set `durationMs: 1500` and `cooldownMs: 6000`, and add `speedMultiplier: 0.7`.
  (Goal values override the placeholder 4000/15000 currently there.)
- `game/server/index.js`:
  - Add `ground_anchor` to the implemented-key-item allowlist guard (the
    `keyItemId !== '...'` chain around line 2851) so it no longer hits the
    `not_implemented` branch.
  - Add a `ground_anchor` handler branch in the `useKeyItem` listener (near the
    other branches ~2856–3004): read `durationMs`/`cooldownMs` from `def`
    (defaults 1500/6000), set `player.anchorUntil = now + durationMs`,
    `player.anchorSpeedMultiplier = def.speedMultiplier ?? 0.7`,
    `player.keyItemCooldownUntil = now + cooldownMs`, `player.persistenceDirty = true`,
    emit `keyItemUsed` to the socket, and broadcast `stateUpdate`.
  - Initialize `anchorUntil: 0` (and `anchorSpeedMultiplier: 1`) in the player
    factory (~line 1146–1154) and in any player-reset path that resets
    `rallyUntil`/`blockingUntil` (~line 1201–1204).
- `game/server/simulation.js`:
  - In the player movement step (~line 314–317, where `blockingUntil` and
    `rallyUntil` already adjust `playerStep`), add:
    `if (now < (player.anchorUntil || 0)) playerStep *= (player.anchorSpeedMultiplier || 0.7);`
  - Add and export an `applyPlayerKnockback(playerId, dirX, dirZ, strength)`
    helper that returns early (no displacement) when `now < player.anchorUntil`,
    otherwise displaces the player via `tryEntityDisplacement` / `tryPlayerMove`
    and writes back `player.x`/`player.z`. Add it to the module exports list and
    re-export from `game/server/index.js` if other modules need it.
- Tests: extend `game/server/test/key-items.test.js` (update the existing
  `ground_anchor` → `not_implemented` case) and/or add
  `game/server/test/ground_anchor.test.js` covering: successful use sets
  `anchorUntil`/cooldown; on_cooldown on immediate re-use; `applyPlayerKnockback`
  ignored while anchored and applied after expiry (use fake timers); speed
  multiplier 0.7 applied during the window.

## Verification: code
