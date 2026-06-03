# Revert dodge-roll cooldown to 800 ms (doc/defs alignment)

Commit `5f95516` raised `KEY_ITEM_DEFS.dodge_roll.cooldownMs` from 800 to 1200 ms for harness screenshot visibility, but player-facing docs (`controls.md`, `gameplay-review.md`) still document 800 ms. Revert the server definition and handler fallback to 800 ms and restore server tests so defs, docs, and behavior match prior shipped balance. Do not change docs or harness — they are already correct at 800 ms.

## Acceptance Criteria

- `KEY_ITEM_DEFS.dodge_roll.cooldownMs` in `game/server/progression.js` is `800`.
- Dodge-roll `useKeyItem` handler in `game/server/index.js` sets `player.keyItemCooldownUntil` using `def.cooldownMs || 800` (not `1200`).
- `game/docs/controls.md` Dodge Roll **Cooldown** bullet (800 ms) matches live defs without edits required.
- `game/docs/gameplay-review.md` dodge-roll cooldown wording (800 ms) matches live defs without edits required.
- `game/server/test/dodge_roll.test.js` and `game/server/test/key-items.test.js` expect `800` for `dodge_roll.cooldownMs` (and any hard-coded `1200` dodge cooldown assertions/comments are updated).
- `pnpm test:quick` (or targeted server tests for dodge/key-items) passes.

## Technical Specs

- **File**: `game/server/progression.js` — in `KEY_ITEM_DEFS.dodge_roll`, set `cooldownMs: 800` (currently `1200`).
- **File**: `game/server/index.js` — in the dodge-roll branch of `useKeyItem` (~line 3239), change `player.keyItemCooldownUntil = now + (def.cooldownMs || 1200)` to use fallback `800`.
- **File**: `game/server/test/dodge_roll.test.js` — update `expect(def.cooldownMs).toBe(1200)` and `frozenNow + 1200` to `800`.
- **File**: `game/server/test/key-items.test.js` — update `getKeyItemDef('dodge_roll')` cooldown expectation and the `// dodge_roll has 1200ms cooldown` comment to 800 ms.
- **Optional alignment**: `game/client/test/main.test.js` mock `mockKeyItemDefs.dodge_roll.cooldownMs` — set to `800` if lobby HUD tests display cooldown from the mock (keeps client fixtures consistent with server defs).
- **Do not change**: `game/docs/controls.md`, `game/docs/gameplay-review.md`, harness capture (`harness/screenshot.mjs`), or invulnerability duration (`invincibleDurationMs: 300`).

## Verification: code
