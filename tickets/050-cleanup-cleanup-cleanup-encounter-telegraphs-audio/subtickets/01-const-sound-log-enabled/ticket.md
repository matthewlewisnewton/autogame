# Change `_soundLogEnabled` from `let` to `const`

`_soundLogEnabled` in `game/client/main.js` is declared with `let` but is only assigned once at module load and never reassigned. Using `const` better signals immutability and avoids a misleading mutable binding.

## Acceptance Criteria
- `_soundLogEnabled` is declared with `const` instead of `let` in `game/client/main.js`.
- All client tests still pass (`vitest run --config vitest.config.js client/test`).

## Technical Specs
- **File**: `game/client/main.js` (line ~92)
- Change `let _soundLogEnabled = ...` to `const _soundLogEnabled = ...`
- No other changes needed; the variable is only read, never reassigned.

## Verification: code
