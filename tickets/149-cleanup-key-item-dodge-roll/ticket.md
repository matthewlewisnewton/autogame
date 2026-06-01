# Cleanup nits from 121-key-item-dodge-roll

> **Staleness note.** This follow-up ticket was written against commit
> `fdd9ead` (2026-06-01). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `121-key-item-dodge-roll`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## controls.md: invulnerability duration vs simulation tick

`game/docs/controls.md` states dodge invulnerability is "~300ms (one simulation tick)". At `TICK_RATE = 20`, one tick is 50 ms; 300 ms is six ticks. Align the doc with either the top-level ticket wording (one tick → ~50 ms in defs) or the implemented 300 ms (drop the "one simulation tick" phrase).

### Acceptance Criteria
- `controls.md` Dodge Roll section describes i-frame duration without contradicting `KEY_ITEM_DEFS.dodge_roll.invincibleDurationMs` or `TICK_RATE`.

## Harness capture: dodge roll not visually exercised

Round-1 capture (`fallback` plan) never pressed the key-item binding (E / D-pad Down). Screenshots show lobby, WASD movement, and sloped-dungeon geometry only — not dash VFX, i-frame shimmer, or cooldown HUD.

### Acceptance Criteria
- Capture plan includes at least one `useKeyItem` / dodge action during `playing` phase with a screenshot or probe asserting `keyItemCooldownRemaining > 0` or visible `#key-item-indicator.cooldown`.

## Client tests for dodge VFX and cooldown HUD

`triggerDashVFX`, `updateKeyItemCooldownHud`, and `flashKeyItemIndicator` have no unit tests under `game/client/test/`, unlike lobby key-item list tests.

### Acceptance Criteria
- At least one client test verifies cooldown HUD classes/text update from mocked `keyItemCooldownRemaining`, or dash jump detection calls `triggerDashVFX` when position delta exceeds threshold.
