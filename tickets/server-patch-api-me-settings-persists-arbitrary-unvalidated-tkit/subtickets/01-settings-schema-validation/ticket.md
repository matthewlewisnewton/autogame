# Settings schema: validateSettings and backfillSettings

Add `validateSettings(partial)` and `backfillSettings(stored)` to `game/server/settings.js`, mirroring the whitelist-and-type-check pattern in `game/server/cosmetic.js` (`validateCosmetic` / `backfillCosmetic`). These functions define the allowed settings shape from `getDefaultSettings()` but are not yet wired into persistence or the PATCH route in this sub-ticket.

## Acceptance Criteria

- `validateSettings` returns `{ ok: false, reason }` for non-object bodies, invalid types, out-of-range values, and unknown nested keys (e.g. bogus `keyboard.bindings` action ids, invalid `gamepad.bindings` shapes).
- `validateSettings` returns `{ ok: true, value }` for valid partial updates covering every whitelisted field: `soundEnabled`, `particlesEnabled`, `showHitboxes`, `lockOnRepeatAction` (`unlock` | `cycle` | `reacquire`), `keyboard.bindings` (only known action keys such as `useKeyItem` with a single lowercase key string), and `gamepad` (`bindings`, `moveStick`, `deadzone`, `profile`, `modifierButton`).
- `backfillSettings` returns a complete settings object with only whitelisted keys, defaults filled from `getDefaultSettings()`, and any unknown or invalid stored fields dropped.
- Unit tests in `game/server/test/settings.test.js` cover validator accept/reject cases and backfill pruning of junk keys.

## Technical Specs

- **`game/server/settings.js`**
  - Add schema constants: top-level key whitelist, `LOCK_ON_REPEAT_ACTIONS`, remappable keyboard action keys (align with `ACTIONS` in `game/client/input.js`), gamepad profile ids (`auto` | `standard` | `8bitdo-64`), `moveStick` values (`left` | `right`), deadzone range (e.g. 0–0.95), and gamepad binding shape rules (button / axis / cButton variants as used in `game/client/gamepad-profiles.js`).
  - Implement `validateSettings(partial)` — only validate provided sub-fields; unknown top-level keys in the partial are ignored (not copied into `value`).
  - Implement `backfillSettings(existing)` — merge stored data onto defaults, prune unknown keys at every level, coerce/clamp valid fields, drop invalid nested values.
  - Export `validateSettings` and `backfillSettings` (do **not** change `updateSettings` / `getSettings` behavior yet).
- **`game/server/test/settings.test.js`**
  - Add `describe('validateSettings')` and `describe('backfillSettings')` blocks with cases for valid partials, type errors, unknown keys, and legacy junk pruning.

## Verification: code
