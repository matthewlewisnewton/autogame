# Add key item binding to attack/cast hint line

Extend `getAttackCastHint()` in `input.js` to append the use-key-item binding (e.g. "· E for key item") when a key item is equipped. Wire `applyAttackHintText()` in `main.js` to pass the equipped key item ID so the hint updates dynamically when the player equips/unequips or rebinds the key item.

## Acceptance Criteria

- `getAttackCastHint(equippedKeyItemId)` appends the resolved key item binding (keyboard key or gamepad button label) to the hint text when `equippedKeyItemId` is truthy
- The appended binding uses the same resolution as `getUseKeyItemBinding()` — reflects custom keyboard binding from settings and gamepad profile
- When `equippedKeyItemId` is `null`/`undefined`, the hint text is unchanged (no key item fragment)
- `applyAttackHintText()` in `main.js` reads `gameState?.players?.[myId]?.equippedKeyItemId` and passes it to `getAttackCastHint()`
- Existing `attack-cast-hint.test.js` tests still pass; new tests cover: (a) key item binding appended when equipped, (b) binding updates when keyboard binding is rebound, (c) no fragment when nothing equipped

## Technical Specs

- **`game/client/input.js`** — Modify `getAttackCastHint()` to accept an optional `equippedKeyItemId` parameter. When truthy, call `getUseKeyItemBinding()` and `getHandSlotInputHints()` to resolve the correct label (keyboard uppercase or gamepad hint), and append `" · {KEY} for key item"` to the returned `text` string.
- **`game/client/main.js`** — Update `applyAttackHintText()` to read `gameState?.players?.[myId]?.equippedKeyItemId` and pass it to `getAttackCastHint(equippedKeyItemId)`. Also update the import to pass the equipped ID.
- **`game/client/test/attack-cast-hint.test.js`** — Add tests for the key item binding fragment: default binding ("E"), rebound binding, gamepad binding label, and absence when no item equipped.

## Verification: code
