# Add Empty Card Slot HTML & CSS

Add the HTML structure and CSS styling for 4 empty card slots rendered as a fixed HUD overlay at the bottom center of the screen.

## Acceptance Criteria
- 4 card slots visible at the bottom center of the screen
- Each slot has a semi-transparent dark background (`rgba(15,23,42,0.75)`) and a subtle border (`rgba(148,163,184,0.3)`)
- Slots do not block player movement or camera controls (`pointer-events: none`)
- Layout re-centers and remains usable on window resize

## Technical Specs
- **`game/client/index.html`** — Append a `<div id="card-hand">` containing 4 `<div class="card-slot"></div>` children, just before `</body>`
- **`game/client/style.css`** — Add rules:
  - `#card-hand`: `position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); display: flex; gap: 12px; padding: 16px; pointer-events: none;`
  - `.card-slot`: `width: 80px; height: 120px; border-radius: 8px; background: rgba(15,23,42,0.75); border: 1px solid rgba(148,163,184,0.3);`
- No JavaScript changes

## Verification: code
