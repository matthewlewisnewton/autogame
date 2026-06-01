# Server: Field Medic Kit — AoE heal + MS restore

Add the `field_medic_kit` implementation to the `useKeyItem` socket handler. When used, all living players in the same run within a ~5 m radius gain partial HP (40 % of `MAX_HP`, capped at `MAX_HP`) and +3 Magic Stones (capped at `MAX_MAGIC_STONES`). Cooldown is 7 s.

## Acceptance Criteria

- `field_medic_kit` is removed from the `not_implemented` guard in `server/index.js` `useKeyItem` handler and gets its own `if (keyItemId === 'field_medic_kit')` branch.
- The `KEY_ITEM_DEFS.field_medic_kit` definition in `server/progression.js` is updated with `healRadius: 5` and `msRestore: 3` (keep existing `healPercent: 0.4`, update `cooldownMs` to `7000`).
- On use, iterates `gameState.players`; for each non-dead, non-extracted player within `healRadius` of caster:
  - `player.hp = Math.min(player.hp + MAX_HP * healPercent, MAX_HP)`
  - `player.magicStones = Math.min(player.magicStones + msRestore, MAX_MAGIC_STONES)`
- Sets `player.keyItemCooldownUntil` to `now + 7000` on the caster.
- Emits `keyItemUsed` with `{ ok: true, keyItemId, cooldownUntil, healed: <count> }`.
- Broadcasts `stateUpdate` via `stateSnapshot()` so all clients see updated HP / MS.

## Technical Specs

| File | Change |
|---|---|
| `game/server/progression.js` (~line 582) | Update `field_medic_kit` def: add `healRadius: 5`, `msRestore: 3`; set `cooldownMs: 7000` |
| `game/server/index.js` (~line 2486) | Add `field_medic_kit` to the implemented guard; add `if (keyItemId === 'field_medic_kit')` branch with AoE heal + MS restore logic, cooldown, emit, and `stateUpdate` broadcast |

Import `MAX_HP` from `config.js` if not already available in scope (it is — used elsewhere in `index.js`).

## Verification: code
