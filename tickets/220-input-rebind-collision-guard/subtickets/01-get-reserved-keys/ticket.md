# Export getReservedKeys for fixed keyboard bindings

Add a small exported helper in `input.js` that lists every lowercase key already claimed by non-remappable `DEFAULT_KEYBOARD` actions (movement, hand slots 1–6, deck viewer, lock-on). This is the single source of truth the settings key-capture flow will use to reject collisions.

## Acceptance Criteria

- `game/client/input.js` exports `getReservedKeys()` returning a `Set` (or read-only array) of lowercase key strings derived from `DEFAULT_KEYBOARD`.
- Reserved keys include `w`, `a`, `s`, `d`, `1`–`6`, `v`, and `z` (the fixed bindings today).
- `useKeyItem` is excluded from the scan so its default `e` and any user-chosen rebind key are not treated as globally reserved.
- Empty binding arrays (e.g. `dodge: []`) contribute no keys.
- `game/client/test/input.test.js` has unit tests covering the reserved set and that `e` is not reserved.

## Technical Specs

- **`game/client/input.js`**
  - Add `export function getReservedKeys()` that iterates `Object.entries(DEFAULT_KEYBOARD)`, skips `useKeyItem`, flattens each action’s `keys` array, lowercases, and omits empty strings.
  - Place the export near `DEFAULT_KEYBOARD` / other public input helpers.
- **`game/client/test/input.test.js`**
  - Import `getReservedKeys`.
  - Assert the set equals the expected fixed keys and does not contain `e`.

## Verification: code
