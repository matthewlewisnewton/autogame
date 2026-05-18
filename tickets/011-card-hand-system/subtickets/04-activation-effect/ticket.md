# Card Activation Flash & Cooldown

When a card is used, its HUD slot plays a visual flash animation and enters a brief cooldown state before becoming usable again.

## Acceptance Criteria
- Immediately after using a card, the corresponding `.card-slot` flashes (bright border or background pulse) for ~200ms
- After the flash, the slot enters a cooldown state for ~1000ms: visually dimmed (reduced opacity or greyed border)
- The slot returns to normal appearance after cooldown expires
- Rapidly pressing the same key again during cooldown triggers the `useCard` emit but does NOT re-play the flash animation (cooldown visual is idempotent)

## Technical Specs
- **Files**: `game/client/main.js`, `game/client/style.css`
- Add CSS classes `.card-slot.activating` (flash: bright white/gold border, short transition) and `.card-slot.cooldown` (dimmed: `opacity: 0.4`, dashed border)
- In `useCard(slotIndex)`, after emitting the socket event, add `.activating` class to the slot element
- Use `setTimeout` to remove `.activating` after 200ms and add `.cooldown`
- Use another `setTimeout` to remove `.cooldown` after 1000ms total
- Track per-slot cooldown state (e.g., `slotCooldowns` array of booleans) so re-triggering during cooldown skips the flash but still emits
- CSS transitions on `.card-slot` for `border-color`, `opacity`, `background` (e.g., `transition: border-color 0.2s, opacity 0.2s`)

## Verification: code
