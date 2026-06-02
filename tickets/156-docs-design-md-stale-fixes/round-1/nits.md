## Stale "Battle Familiar" display name in server debug hand injection

`game/server/index.js` still assigns `name: 'Battle Familiar'` when injecting a `battle_familiar` card into a player's hand, while card registries and the updated design doc use "Signal Familiar". Cosmetic inconsistency only; not introduced by this ticket.

### Acceptance Criteria
- Any server-side hand injection or default card objects use `name: 'Signal Familiar'` for `id: 'battle_familiar'`, matching `progression.js` and `cards.js`.

## Replace ticket-number reference in Floor Geometry section

`game/docs/design.md` Floor Geometry still says player slope movement "is implemented in ticket 117". That process reference will go stale; pointing at the implementing module (e.g. collision/movement code) would age better.

### Acceptance Criteria
- Floor Geometry references the code path that adjusts `player.y` on slopes, not a ticket number.
