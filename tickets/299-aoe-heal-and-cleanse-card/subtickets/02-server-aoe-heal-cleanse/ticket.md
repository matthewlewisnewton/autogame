# Server AoE heal + cleanse effect and tests

Implement the `purifying_pulse` spell combat logic: heal every living, non-extracted ally within `radius` of the cast point for a small flat amount, then cleanse negative statuses on each healed target. Wire the effect into `cardEffects.js` and add focused server tests.

## Acceptance Criteria

- A new exported helper `clearNegativeStatuses(entity)` in `game/server/simulation.js` resets all negative player status fields:
  - `slowedUntil` → `0`, `slowFactor` → `1`
  - `burningUntil` → `0`, `lastBurnTickAt` → `null`
  - `frozenUntil` → `0` (when present on the entity)
  - `debuffs` → `[]` (clear the entire debuff array, not just the oldest)
- A new exported helper `healPlayersInRadius(originX, originZ, radius, healAmount)` in `game/server/simulation.js`:
  - Iterates all players in the current run; skips `dead` and `extracted`.
  - For each player with `Math.hypot(p.x - originX, p.z - originZ) <= radius`, calls `healPlayer` and `clearNegativeStatuses`.
  - Returns an array of `{ playerId, hpGained, cleansed: true }` for every player actually healed (including the caster when in range).
- `game/server/cardEffects.js` spell branch handles `cardDef.effect === 'purifying_pulse'` (modelled on `healing_font` / `divine_grace`):
  - Uses caster position `(originX, originZ)` as the AoE center.
  - Applies slot cooldown and consumes the card like other single-use spells.
  - Emits `SERVER_TO_CLIENT.CARD_USED` with `origin`, `radius`, `healedTargets` (the array from the helper), and `specialEffect: 'heal_and_cleanse'`.
  - Emits `SERVER_TO_CLIENT.STATE_UPDATE` after applying effects.
- New vitest coverage in `game/server/test/purifying_pulse.test.js` proves:
  - Two players within radius both gain HP; an out-of-range third player is unchanged.
  - A player with `slowedUntil` in the future is no longer slowed after the cast (`isSlowed` false).
  - A player with `burningUntil` in the future is no longer burning after the cast (`isBurning` false).
  - A player with active `debuffs` has an empty `debuffs` array after the cast.
  - Dead and extracted players in radius are skipped (no heal, no cleanse).
  - Caster self-heals when standing at the cast origin.

## Technical Specs

- **`game/server/simulation.js`**:
  - Add `clearNegativeStatuses(entity)` and `healPlayersInRadius(originX, originZ, radius, healAmount)` near `healPlayer` (~1208).
  - Export both helpers from `module.exports`.
- **`game/server/cardEffects.js`**:
  - Import `healPlayersInRadius` from simulation (alongside existing `healPlayer`).
  - Add an `if (cardDef.effect === 'purifying_pulse')` block after the `divine_grace` handler (~582), before `gravity_well`.
  - Read `radius` and `healAmount` from `cardDef`; use caster `(player.x, player.z)` as origin.
- **`game/server/index.js`**: re-export the new helpers if other modules/tests need them (follow existing `healPlayer` pattern).
- **`game/server/test/purifying_pulse.test.js`**:
  - Unit-test helpers with a minimal `gameState.players` fixture (same style as `slow_status.test.js` / `burning_status.test.js`).
  - Include at least one socket integration test via `useCard` if a lightweight harness exists (optional but preferred).
- Do **not** change client rendering in this sub-ticket.

## Verification: code
