# 03 — Fix playtesting example card display name

The Playtesting Notes bullet lists “Battle Familiar” as an example spell, but the
canonical in-game name for card id `battle_familiar` is **Signal Familiar** in
`CARD_DEFS`. Correct the example so the design doc matches live card data.

## Acceptance Criteria

- Only `game/docs/design.md` is modified.
- `### Playtesting Notes (Spell vs Weapon Overlap)` uses **Signal Familiar** (not
  Battle Familiar) when citing `battle_familiar`.
- **Mana Leach** remains named as-is (verify id `mana_leach` in `CARD_DEFS`).
- No other sections of `design.md` are reworded; structure and headings unchanged.
- The edit is grounded in `game/server/progression.js` `CARD_DEFS` (and
  `game/client/cards.js` if needed for display-name parity).

## Technical Specs

- Edit `game/docs/design.md` only — the playtesting example parenthetical in
  `### Playtesting Notes (Spell vs Weapon Overlap)`.
- Cross-check:
  - `game/server/progression.js` → `CARD_DEFS.battle_familiar.name` is
    `'Signal Familiar'`.
  - `game/server/progression.js` → `CARD_DEFS.mana_leach.name` for the second
    example.
- Single-word fix in the example list unless a clarifying “(`battle_familiar`)”
  parenthetical is already used elsewhere in the doc (optional, not required).

## Verification: code
