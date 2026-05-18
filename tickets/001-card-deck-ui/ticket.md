# Card Deck UI

Render 4 empty card slots at the bottom of the screen as a HUD overlay on the 3D view. Each slot should be a rounded rectangle with a subtle border. Cards will eventually be drawn from the player's deck and displayed here.

## Acceptance Criteria
- 4 card slots visible at the bottom center of the screen
- Slots are styled with a semi-transparent dark background
- Slots do not block player movement or camera controls
- Layout is responsive to window resizing

## Technical Specs
- **File to modify**: `game/client/index.html` and `game/client/style.css`
- **Implementation**: Pure HTML/CSS overlay with `position: fixed; bottom: 0;` container
- **Card slot**: `width: 80px; height: 120px; border-radius: 8px; background: rgba(15, 23, 42, 0.75); border: 1px solid rgba(148, 163, 184, 0.3);`
- **Container**: Flexbox row, centered, `gap: 12px`, `padding: 16px`, `pointer-events: none;`
- **No JavaScript required** for this ticket — purely visual scaffolding
