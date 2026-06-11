# Lock-on info panel and quest comms log vertical stack

Move the lock-on HUD card and persistent quest comms log into `#top-right-hud-stack` so they flow below the key-item badge instead of fighting for the same `top: 44px` / `top: 92px` absolute slots.

## Acceptance Criteria

- `#lock-on-info-panel` and `#quest-comms-log` are children of `#top-right-hud-stack`, ordered after `#key-item-indicator`.
- Neither element uses the old conflicting absolute anchors (`#lock-on-info-panel` `top: 44px; right: -8px`, `#quest-comms-log` `top: 92px; right: 16px`).
- When lock-on is active (`#lock-on-info-panel` visible, not `.hidden`) and the comms log has at least one `.quest-comms-line`, the two panels' bounding boxes do not intersect at 1280×800.
- When lock-on is hidden, the comms log sits directly below the key-item badge with no empty gap larger than the stack `gap`.
- Lock-on panel content sync (`syncLockOnInfoPanel` in `lock-on-info-panel.js`) and comms log append/cap behavior (`appendQuestCommsLog` in `main.js`) are unchanged aside from layout.

## Technical Specs

- **`game/client/index.html`** — Move `#lock-on-info-panel` and `#quest-comms-log` inside `#top-right-hud-stack` (below `#key-item-indicator`).
- **`game/client/style.css`** — Update `#lock-on-info-panel` and `#quest-comms-log.quest-comms-log`:
  - Drop absolute `top` / `right` positioning; rely on flex column flow inside `#top-right-hud-stack`.
  - Keep width, chrome, `pointer-events: none`, typography, and `.hidden` behavior.
  - Preserve `body[data-phase="lobby"] #quest-comms-log { display: none !important; }`.
- **`game/client/lock-on-info-panel.js`** — No logic changes expected; confirm `syncLockOnInfoPanel` still toggles `.hidden` / `aria-hidden` only.
- Do **not** change quest comms toast placement (`showQuestCommsToast`) — that is sub-ticket 03.

## Verification: code
