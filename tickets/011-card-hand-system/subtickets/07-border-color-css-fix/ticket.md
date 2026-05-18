# Fix Border Color Override — Make Activation/Cooldown CSS Effective

`renderHand()` sets `slot.style.borderColor` inline on every render, which outranks the `.card-slot.activating` and `.card-slot.cooldown` border-color rules in `style.css`. As a result, the gold flash border (`#fbbf24`) and the grey cooldown border (`rgba(148,163,184,0.5)`) never appear. Drive the base border color through a CSS custom property so class selectors can override it.

## Acceptance Criteria
- `.card-slot.activating` border-color (`#fbbf24`) is visually applied during the 200ms flash
- `.card-slot.cooldown` border-color (`rgba(148,163,184,0.5)`) is visually applied during the cooldown period
- The card's type color (from `CARD_TYPE_STYLE`) is still shown as the slot's normal border color when not in an effect state
- No inline `borderColor` assignment remains in `renderHand()` that would override CSS class rules

## Technical Specs
- **Files**: `game/client/main.js` (`renderHand()`), `game/client/style.css` (`.card-slot` base rule)
- In `renderHand()`, replace `slot.style.borderColor = style.color` with `slot.style.setProperty('--slot-color', style.color)`
- In `style.css`, change the base `.card-slot` rule from `border: 2px solid rgba(148,163,184,0.3)` to `border: 2px solid var(--slot-color, rgba(148,163,184,0.3))`
- The `.activating` and `.cooldown` class selectors already set explicit `border-color` values — they will now correctly override the CSS variable

## Verification: code
