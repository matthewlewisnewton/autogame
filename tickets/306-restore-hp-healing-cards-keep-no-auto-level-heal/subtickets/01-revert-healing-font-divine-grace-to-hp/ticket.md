# 01 — Revert healing_font / divine_grace to HP restore (server)

Ticket 287/11 converted `healing_font` (Restoration Beacon) and `divine_grace` (Sanctum Pulse) from HP-restore spells to Magic-Stone-restore spells. Revert: both cards should restore HP again via `healPlayer()`.

## Acceptance Criteria

- `CARD_DEFS.healing_font.healAmount` is a positive number (6); `magicStoneRestore` is removed
- `CARD_DEFS.divine_grace.healAmount` is a positive number (10); `magicStoneRestore` is removed
- Using `healing_font` in combat calls `healPlayer()` and increases caster HP by `healAmount` (capped at `MAX_HP`)
- Using `divine_grace` in combat calls `healPlayer()` and increases caster HP by `healAmount` (capped at `MAX_HP`)
- `CARD_USED` payload for both cards includes `hpGained` (not `magicStonesGained`)
- Magic Stones are NOT changed when either card is used
- Existing server tests pass (updated to expect HP healing, not MS restore)

## Technical Specs

**`game/shared/cardStats.json`** — For both `healing_font` and `divine_grace`:
- Replace `"magicStoneRestore": N` with `"healAmount": N` (6 and 10 respectively)
- Keep `"specialEffect": "mana_restore"` unchanged (client uses it for renderer lookup; visual update is sub-ticket 04)

**`game/server/cardEffects.js`** — In the spell branch, both `healing_font` and `divine_grace` handlers:
- Replace `addMagicStones(player, cardDef.magicStoneRestore || 0)` with `healPlayer(socket.playerId, cardDef.healAmount || 0)`
- Rename local from `magicStonesGained` to `hpGained`
- In the `CARD_USED` emit, replace `magicStonesGained` with `hpGained`

**`game/server/test/server.test.js`** — Update the test `"remains the sole player HP-restore path"`:
- Change assertions from `expect(CARD_DEFS.healing_font.healAmount).toBeUndefined()` to `expect(CARD_DEFS.healAmount).toBe(6)` (and 10 for divine_grace)

**`game/server/test/new_card_pack.test.js`** — Update:
- `"Restoration Beacon restores Magic Stones without changing HP"` → test that it restores HP (6) without changing MS
- `"Sanctum Pulse restores magic stones without changing HP"` → test that it restores HP (10) without changing MS

## Verification: code
