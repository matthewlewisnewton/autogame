# Move client visual/UI tunables into config

Extract remaining inline numeric literals in `game/client/main.js` into `game/client/config.js` so all client-side visual and camera values are centrally configurable.

## Acceptance Criteria
- `game/client/config.js` exports constants for: `DAMAGE_NUMBER_DURATION` (1000), `CAMERA_FOV` (75), `CAMERA_NEAR` (0.1), `CAMERA_FAR` (1000).
- `game/client/main.js` imports and uses those four constants instead of inline literals.
- The inline values `1000` (damage number duration in `spawnDamageNumber`), `75` (camera FOV), `0.1` (camera near), and `1000` (camera far) no longer appear as magic numbers in the `PerspectiveCamera` constructor or damage number object.
- Existing client tests continue to pass.
- No other changes — do not touch server code, styling, or unrelated client logic.

## Technical Specs
- **Files to change:** `game/client/config.js` (add 4 exports), `game/client/main.js` (import + replace 4 literals)
- Add to `config.js` (under a `// ── Visual effects ──` or `// ── Camera ──` section):
  - `DAMAGE_NUMBER_DURATION = 1000`
  - `CAMERA_FOV = 75`
  - `CAMERA_NEAR = 0.1`
  - `CAMERA_FAR = 1000`
- In `main.js`, import the new constants and replace:
  - `duration: 1000` → `duration: DAMAGE_NUMBER_DURATION` (in `spawnDamageNumber`)
  - `new THREE.PerspectiveCamera(75, ...)` → `new THREE.PerspectiveCamera(CAMERA_FOV, window.innerWidth / window.innerHeight, CAMERA_NEAR, CAMERA_FAR)`
- No other changes.

## Verification: code
