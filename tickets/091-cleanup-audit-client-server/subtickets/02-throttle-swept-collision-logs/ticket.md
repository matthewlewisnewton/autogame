# Throttle swept-collision rejection log spam

Holding movement into a wall emits repeated `console.warn` messages on every tick. Downgrade to `console.debug` (or silence entirely) so expected player input doesn't flood normal server logs, while keeping diagnostics for invalid/malformed payloads.

## Acceptance Criteria
- Repeated swept-collision movement rejections no longer use `console.warn`; they use `console.debug` or are silenced.
- Invalid or malformed movement payloads (missing data, bad fields) still produce useful diagnostics at `console.warn` level or above.
- No change to the swept-collision rejection logic itself — moves are still rejected the same way.

## Technical Specs
- **File:** `game/server/index.js`
- Change the `console.warn` on line ~1374 (inside the `move` handler, after `checkSweptCollision`) to `console.debug`.
- Do not touch `checkSweptCollision()`, the rejection `return`, or any other validation logic.
- No other changes.

## Verification: code
