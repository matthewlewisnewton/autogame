# Input Validation on Server

Validate all incoming socket data on the server to prevent crashes and cheating.

## Acceptance Criteria
- `move` handler rejects payloads where `x`, `y`, `z`, or `rotation` are not finite numbers
- Malformed or missing payloads do not crash the server
- Position changes are clamped to world bounds (-25 to 25 on x/z)
- Server logs rejected inputs

## Technical Specs
- **File to modify**: `game/server/index.js`
- **Validation**: `if (!data || ![data.x, data.y, data.z, data.rotation].every(Number.isFinite)) return;`
- **Clamping**: `Math.max(-25, Math.min(25, data.x))` for x and z
- **No client changes needed**
