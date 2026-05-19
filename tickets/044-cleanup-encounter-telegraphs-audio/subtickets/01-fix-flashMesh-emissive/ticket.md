# Fix flashMesh emissive capture

`flashMesh()` uses `mat.emissive.get()` to save the original emissive color before flashing — `THREE.Color` has no `.get()` method, so `origEmissive` is always `undefined` (coerced to `0x000000`). When a flash restores an enemy mid-windup, it clears the red telegraph tint instead of preserving it.

Replace `.get()` with `.getHex()` so the real emissive value is captured and restored correctly.

## Acceptance Criteria
- `flashMesh` captures the current emissive via `mat.emissive.getHex()` (not `.get()`).
- An enemy hit during wind-up retains its red telegraph tint after the white flash restores.
- Existing `flashMesh` unit tests continue to pass.
- `npm test` passes with 0 failures.

## Technical Specs
- **File**: `game/client/main.js` — line ~613, change `mat.emissive.get()` to `mat.emissive.getHex()`
- **File**: `game/client/test/main.test.js` — update any mock/test that asserts on the captured emissive value if needed

## Verification: code
