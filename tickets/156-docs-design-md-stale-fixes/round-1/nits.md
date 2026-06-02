## Playtesting example still uses legacy Mana Leach name

The `### Playtesting Notes` line was updated for Signal Familiar but still says **Mana Leach** while `CARD_DEFS.mana_leach.name` is **Ether Siphon** in `game/server/progression.js` and `game/client/cards.js`. A one-word example fix in the same parenthetical would complete naming accuracy for that bullet.

### Acceptance Criteria

- `game/docs/design.md` playtesting example uses **Ether Siphon** (or cites `mana_leach` with the live display name from `CARD_DEFS`).
- No other sections of `design.md` are reworded.
