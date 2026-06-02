# Echo Strike — key item activation & pending state

Make the `echo_strike` key item activatable: `useKeyItem` arms an `echoStrikePending`
flag on the caster and burns the cooldown, instead of returning `not_implemented`.
This sub-ticket only wires up activation/state — the actual second-hit damage is
done in sub-ticket 02.

## Acceptance Criteria

- The `echo_strike` definition in `KEY_ITEM_DEFS` (server/progression.js) has
  `cooldownMs: 10000` and an explicit echo fraction field `echoFraction: 0.5`.
  Its `description` reflects the new behaviour (next weapon hit echoes for 50%),
  not the old "radial burst" text.
- `getUnlockedKeyItems()` still returns all 14 items including `echo_strike`
  (existing key-items.test.js continues to pass).
- `useKeyItem` with `keyItemId: 'echo_strike'` while in the `playing` phase
  returns `{ ok: true, keyItemId: 'echo_strike', echoStrikePending: true, cooldownUntil }`
  and sets `player.echoStrikePending = true`.
- The same call sets `player.keyItemCooldownUntil` to `now + 10000` (driven by
  `def.cooldownMs`), and a second immediate use returns
  `{ ok: false, reason: 'on_cooldown', remainingMs > 0 }`.
- `echo_strike` is no longer included in the `not_implemented` guard list.
- `echoStrikePending` is transient: `extractPersistentData()` does NOT include it
  (mirrors how `invulnerableUntil` / `keyItemCooldownUntil` are excluded).
- A `stateUpdate` is broadcast to the lobby after a successful activation.

## Technical Specs

- `game/server/progression.js`: update the `echo_strike` entry in `KEY_ITEM_DEFS`
  — set `cooldownMs: 10000`, add `echoFraction: 0.5`, drop/replace the misleading
  `radius`/`damage` burst fields and revise `description`. Keep `id`/`name`.
- `game/server/index.js`, `useKeyItem` socket handler (around line 2638): remove
  `'echo_strike'` from the `not_implemented` condition and add a handler branch
  that sets `player.echoStrikePending = true`, `player.keyItemCooldownUntil =
  now + (def.cooldownMs || 10000)`, `player.persistenceDirty = true`, emits
  `keyItemUsed` with `{ ok: true, keyItemId, echoStrikePending: true, cooldownUntil }`,
  and broadcasts `io.to(lobby.id).emit('stateUpdate', stateSnapshot())`.
- `game/server/index.js`, `extractPersistentData()` (around line 975): confirm the
  field allow-list does not copy `echoStrikePending` (it is built field-by-field,
  so no change should be needed — verify and leave transient).
- Add/extend tests in `game/server/test/key-items.test.js` covering activation,
  the pending flag, the 10s cooldown, and persistence exclusion.

## Verification: code
