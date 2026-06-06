# 02 — Increase boss scale and add emissive glow

All four stage bosses need to read as "boss" at a glance. Currently the Annex Overseer (radius 0.95) is only marginally larger than a grunt (radius 0.5), and the Spire Warden has no emissive glow. Increase the procedural cone dimensions for all four bosses to be ~2× the size of trash enemies, and ensure every boss has emissive glow.

## Acceptance Criteria

- All four stage bosses (`annex_overseer`, `arena_champion`, `spire_warden`, `canyon_warden`) have cone radius >= 1.0 and height >= 2.2 in `ENEMY_GEOMETRY`
- All four stage bosses have `emissive` and `emissiveIntensity` set (>= 0.4) in `ENEMY_GEOMETRY`
- Boss dimensions are at least 2× the grunt's dimensions (grunt: radius 0.5, height 1.0)
- Each boss has a visually distinct color from the other bosses and from trash enemies
- `arena_champion` retains its existing larger size (already the biggest at 1.2 × 2.8) but emissive is bumped to >= 0.5
- Existing renderer tests still pass (`renderer-registry-normalize.test.js` checks `ENEMY_GEOMETRY`)

## Technical Specs

- **`game/client/renderer.js`** — Update `ENEMY_GEOMETRY` entries for the four bosses:
  - `annex_overseer`: radius 1.1, height 2.4, emissiveIntensity 0.5 (keep teal color `0x0d9488` / emissive `0x14b8a6`)
  - `arena_champion`: radius 1.3, height 3.0, emissiveIntensity 0.5 (keep amber `0xffaa00` / emissive `0xcc3300`)
  - `spire_warden`: radius 1.0, height 2.2, add `emissive: 0x55aaff`, `emissiveIntensity: 0.4` (keep blue color `0x3388cc`)
  - `canyon_warden`: radius 1.0, height 2.2, add `emissive: 0xffaa44`, `emissiveIntensity: 0.4` (keep amber-brown color `0xcc8800` from sub-ticket 01)
- Do NOT change trash enemy sizes (grunt, skirmisher, spawner remain unchanged).
- Update any test assertions in `renderer-registry-normalize.test.js` that check specific boss dimensions if they break.

## Verification: visual
