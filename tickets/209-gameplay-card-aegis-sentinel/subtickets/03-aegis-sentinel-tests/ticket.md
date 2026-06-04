# Aegis Sentinel tests and client parity checks

Add or extend automated coverage for `aegis_sentinel` definitions, shop availability, cast behavior (shield + taunt wall), and client card catalog parity. Depends on sub-tickets 01–02.

## Acceptance Criteria

- A server test file (preferred: `game/server/test/aegis_sentinel.test.js`, or extend `game/server/test/astral_guardian.test.js`) asserts `CARD_DEFS.aegis_sentinel` matches the parent ticket stats (`magicStoneCost: 45`, `damage: 0`, `shieldHp: 30`, `shieldDurationMs: 8000`, `minionHp: 160`, `minionTtl: 30`, `attackDamage: 0`, `taunt: true`, `isEvolved: true`, `type: 'creature'`).
- An integration-style test (socket `useCard` or direct handler setup like `astral_guardian.test.js`) verifies: shield applied to caster, taunt minion spawned, zero enemy HP loss from the cast burst, and taunt draws enemy hits to the minion (pattern from `new_card_pack.test.js` “Necroframe Knight taunt draws enemy attacks”).
- `SHOP_CARD_POOL` (or config export) includes `aegis_sentinel`.
- `game/client/test/cards.test.js` updated: `creatureCardIds` includes `aegis_sentinel` (adjust expected set size), and `CARD_DEFS.aegis_sentinel` parity assertion if the file tests pack cards.
- Any tests that assert total `CARD_DEFS` key count (e.g. `new_card_pack.test.js` `toHaveLength(40)`) are bumped to the new total.
- `pnpm test:quick` from `game/` passes with no regressions.

## Technical Specs

- **`game/server/test/aegis_sentinel.test.js`** (new) or **`game/server/test/astral_guardian.test.js`**: import `CARD_DEFS`, `connectAndJoinLobby`, `startTestServer`, `lobbyGameState`, `waitForEvent`, `spawnEnemy`, `updateEnemies` / `updateMinions` as needed. Mirror structure from `astral_guardian.test.js` gameplay block and `new_card_pack.test.js` taunt test.
- **`game/server/test/new_card_pack.test.js`**: update `Object.keys(CARD_DEFS).toHaveLength(...)` if present; optionally add `aegis_sentinel` to a pack list only if this file is the canonical catalog test.
- **`game/client/test/cards.test.js`**: increment `creatureCardIds.size` expectation and add `aegis_sentinel` to relevant lists / `CARD_ACCENT_STYLE` loop if applicable.
- **`game/server/config.js`**: no functional change if 01 already added pool entry — test only asserts presence.

## Verification: code
