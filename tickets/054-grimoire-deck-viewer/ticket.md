# Ticket: Grimoire In-Game Deck Viewer

## Goal
Implement an in-game overlay that allows players to view the cards remaining in their draw pile (deck). This improves tactical decision-making by letting players know which summons or weapons are still available.

## Background
Currently, the player's 30-card deck is managed in `hand.js`, but there is no way to see what's left during a dungeon run. Players must rely on memory, which is difficult for a deck of up to 12-30 cards.

## Proposed Changes

### Deck Overlay
- **Trigger**: Add a keybind (Default: `V`) or make the physical deck visual clickable to toggle the overlay.
- **Visuals**: A translucent full-screen or modal overlay that displays a grid of card "mini-faces."
- **Content**: Shows all card IDs currently in the `deck` array in `hand.js`. 
- **Type Icons**: Each card in the list should display its type icon (⚔, ✦, 🐉) and name.

### Physical Deck Visual
- **Position**: Bottom-right corner of the screen, near the hand.
- **Visual**: A simple CSS-based stack of cards. The height of the stack (number of card layers) should be proportional to `deck.length`.
- **Tooltip**: Hovering over the deck should show a count (e.g., "Deck: 14/30").

### Card Hand Polish
- **Color Coding**: Ensure the 4 card slots in the hand use the `CARD_TYPE_STYLE` colors for their borders so players can instantly recognize a Summon vs. a Weapon.
- **Layout**: Slightly tighten the hand layout to make room for the new Deck visual.

## Implementation Details
- **CSS**: Add `#deck-viewer-overlay` and `.deck-card-mini` to `style.css`.
- **JS**: 
    - In `main.js`, listen for the deck toggle key.
    - Create a `renderDeckViewer()` function that populates the overlay based on the `deck` array in `hand.js`.
    - Update the visual stack height whenever `drawCard()` is called.

## Verification Plan
1. Start a run and press `V` to open the deck viewer.
2. Verify that all 8 (starting) or up to 12 (selected) cards are listed.
3. Use cards until they are discarded and new ones are drawn; verify the deck viewer updates to reflect the removals.
4. Verify the physical deck stack in the corner visually shrinks as cards are drawn.
