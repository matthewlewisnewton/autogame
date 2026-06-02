# 03 — Live cosmetic preview

Render a small Three.js preview inside `#cosmetic-preview` that mirrors the
selected `bodyShape`, `bodyColor`, and `accentColor`. The preview updates
immediately when the user changes any picker (no server round-trip).

## Acceptance Criteria

- `game/client/cosmetic-preview.js` exports `initCosmeticPreview(containerEl)` and `updateCosmeticPreview({ bodyShape, bodyColor, accentColor })`.
- Preview draws the correct primitive per shape: `BoxGeometry`, `CylinderGeometry`, `ConeGeometry`, `CapsuleGeometry` (match names allowed by server `BODY_SHAPES`).
- Body material uses `bodyColor`; a secondary accent mesh or emissive trim uses `accentColor`.
- Calling `updateCosmeticPreview` after a shape/color change replaces or recolors meshes without leaking GPU resources (dispose prior exclusive geometry/material on shape change).
- `initCosmeticPreview` is safe to call once when the account overlay first opens; repeated calls are idempotent or guarded.
- Unit test (jsdom or minimal mock) asserts `updateCosmeticPreview` switches geometry type when `bodyShape` changes and does not throw when container is detached.

## Technical Specs

- **File**: `game/client/cosmetic-preview.js` (new)
  - Own a `THREE.Scene`, `PerspectiveCamera`, `WebGLRenderer` sized to the container's client width/height; slow idle rotation optional.
  - Map `bodyShape` string → geometry factory; invalid shape falls back to `box`.
  - Parse colors with `new THREE.Color(bodyColor)` (invalid hex falls back to default blue).
- **File**: `game/client/test/cosmetic-preview.test.js` (new)
  - Mock `THREE` or use real three in vitest; verify geometry swap on shape change.
- No changes to `main.js` yet beyond a stub import if needed for the test harness — wiring to pickers is sub-ticket 04.

## Verification: code
