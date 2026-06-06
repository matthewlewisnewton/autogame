# 01-boss-emissive-glow

Give every stage boss an emissive glow in `ENEMY_GEOMETRY` so the boss reads as "special" even before glTF models load. Currently `miniboss` (Vault Warden) and `spire_warden` (Summit Warden) have no emissive glow, while `annex_overseer` and `arena_champion` already do.

Add `emissive` and `emissiveIntensity` to the `miniboss` and `spire_warden` entries in `ENEMY_GEOMETRY`, matching the color scheme of each boss's base color.

## Acceptance Criteria

- `ENEMY_GEOMETRY.miniboss` has `emissive` and `emissiveIntensity` properties set (emissive color derived from its purple base `0x8800cc`)
- `ENEMY_GEOMETRY.spire_warden` has `emissive` and `emissiveIntensity` properties set (emissive color derived from its blue base `0x3388cc`)
- All four stage bosses (`miniboss`, `annex_overseer`, `arena_champion`, `spire_warden`) have emissive glow configured
- Existing emissive settings on `annex_overseer` and `arena_champion` are unchanged
- Tests pass (`pnpm test`)

## Technical Specs

- **File:** `game/client/renderer.js` — `ENEMY_GEOMETRY` table (lines ~352-359)
- Add `emissive: 0x6600aa, emissiveIntensity: 0.3` to `miniboss` entry (muted purple glow)
- Add `emissive: 0x2266aa, emissiveIntensity: 0.3` to `spire_warden` entry (muted blue glow)
- No server changes needed; no new files

## Verification: code
