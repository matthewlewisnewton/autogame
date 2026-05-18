# Card Deck UI Slots

Render 4 empty card slots at the bottom of the screen as a HUD overlay.

## Acceptance Criteria
- 4 card slots visible at the bottom center of the screen
- Slots styled with semi-transparent dark background and subtle border
- Slots do not block player movement or camera controls (pointer-events: none)
- Layout is responsive to window resizing

## Technical Specs
- **Files to modify**: `game/client/index.html`, `game/client/style.css`
- Add a `<div id="card-hand">` with 4 `<div class="card-slot">` children to `index.html`
- CSS: Container uses `position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); display: flex; gap: 12px; padding: 16px; pointer-events: none;`
- CSS: Each slot uses `width: 80px; height: 120px; border-radius: 8px; background: rgba(15,23,42,0.75); border: 1px solid rgba(148,163,184,0.3);`
- No JavaScript changes needed
