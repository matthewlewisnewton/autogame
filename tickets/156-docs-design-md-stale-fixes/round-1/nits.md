## Lobby deck-size HTML placeholder still says /12

The static fallback in `game/client/index.html` for `#deck-size-display` is `0/12`, while `main.js` updates it to `selectedLength/24` once deck state loads. The placeholder can flash wrong values or confuse readers grepping for stale limits.

### Acceptance Criteria
- Change the `deck-size-display` default text in `index.html` to `0/24` (or another neutral placeholder matching `DECK_MAX_SIZE`).

## Repo CONTEXT.md still describes 4-card hand

Root `CONTEXT.md` (harness/agent orientation) still says players hold “a hand of up to 4 cards,” which no longer matches `MAX_HAND_SLOTS = 6` or the updated `design.md`.

### Acceptance Criteria
- Update the hand-size sentence in `CONTEXT.md` to “up to 6 cards” (and deck cap to 24 if mentioned elsewhere in that file).
