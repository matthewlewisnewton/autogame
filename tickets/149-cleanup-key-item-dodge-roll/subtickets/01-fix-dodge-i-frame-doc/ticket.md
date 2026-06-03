# Fix dodge-roll i-frame duration wording in controls.md

The Dodge Roll section in `game/docs/controls.md` says invulnerability lasts "~300ms (one simulation tick)", but at `TICK_RATE = 20` one tick is 50 ms while `KEY_ITEM_DEFS.dodge_roll.invincibleDurationMs` is 300 ms (six ticks). Align the doc with the implemented value and drop the incorrect tick claim.

## Acceptance Criteria

- `game/docs/controls.md` Dodge Roll **Invulnerability** bullet states ~300 ms (or 300 ms) and does **not** claim "one simulation tick".
- The same bullet does not contradict `KEY_ITEM_DEFS.dodge_roll.invincibleDurationMs` (300) in `game/server/progression.js`.
- Cooldown (800 ms), direction, and collision bullets in the Dodge Roll subsection are unchanged.

## Technical Specs

- **File**: `game/docs/controls.md` — edit the `### Dodge Roll` subsection (~line 44–51).
- Replace the invulnerability line, e.g. `- **Invulnerability:** ~300ms — you cannot take damage during this window` (no tick parenthetical).
- **Reference only** (do not change): `game/server/progression.js` `KEY_ITEM_DEFS.dodge_roll.invincibleDurationMs: 300`; `game/server/config.js` `TICK_RATE = 20`.

## Verification: code
