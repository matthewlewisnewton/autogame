# Ticket: PSO "Vanguard" HUD Overhaul

## Goal
Replace the current generic top-center health and magic stone (MS) bars with a corner-anchored, stylized HUD inspired by *Phantasy Star Online Episodes I & II*. This improvement focuses on visual fidelity to the source material and improving peripheral awareness of player stats.

## Background
*Phantasy Star Online* is known for its iconic elliptical UI elements that wrap around character portraits. The current UI in `autogame` uses standard horizontal bars which feel out of place in a PSO-inspired RPG.

## Proposed Changes

### UI Layout
- **Position**: Move the main HUD from `top: 50% / transform: translateX(-50%)` to the **Top-Left** corner.
- **HP Bar**: Implement an elliptical/curved bar design. The bar should be thicker at the start and taper slightly.
- **MS Bar**: Implement a secondary elliptical bar offset below the HP bar, following a similar curve but with the "Magic Stone" amber/yellow color palette.
- **Character Frame**: Add a circular/hexagonal frame placeholder for a character icon or player ID.
- **Deck Statistics**: Add a small, secondary panel below the MS bar that shows real-time deck status:
    - **Draw Pile Count**: e.g., "Deck: 12/30"
    - **Type Breakdown**: Small icons (⚔, ✦, 🐉) with counts of how many cards of each type remain in the draw pile.

### Visual Style
- **Gradients**: Use vibrant, high-contrast gradients for the bars (Green/Dark Green for HP, Yellow/Orange/Amber for MS).
- **Glow Effects**: Add a subtle outer glow (`box-shadow` or `filter: drop-shadow`) to the bars to simulate the "Photon" technology aesthetic.
- **Typography**: Change the font for the HP/MS numbers to a more futuristic, monospace or high-tech font (e.g., 'Exo 2' or 'Roboto Mono').
- **Level Indicator**: Add a small "LV" label followed by the player's level near the character frame.

### Implementation Details
- **CSS**: Update `#hp-bar-container` and `#ms-bar-container` in `style.css`. Use `clip-path` or advanced `border-radius` with skewed transforms to achieve the curved bar look without images if possible, or use SVGs.
- **HTML**: Modify `index.html` to group these elements under a new `#vanguard-hud` wrapper.
- **JS**: Ensure `main.js` still targets the correct IDs for updating fill percentages.

## Verification Plan
1. Launch the game and verify the HUD is correctly anchored to the top-left.
2. Take damage from enemies and ensure the new HP bar updates smoothly.
3. Use cards and ensure the MS bar and the deck statistic counts (e.g., Weapon count decrementing) update and reflect the new aesthetic.
4. Test on different screen resolutions to ensure the HUD doesn't overlap with other elements.
