# Client Rewards Display in Summary Overlay

Update the client run summary overlay to display earned currency and card names from the server's `runComplete` / `runFailed` payload. Add HTML elements for a rewards section and render the card reward list.

## Acceptance Criteria
- The run summary overlay includes a rewards section showing earned currency and card names.
- When `runComplete` or `runFailed` is received, `showRunSummary()` extracts per-player rewards from the payload and renders them.
- The overlay displays the currency earned (bonus + picked up) and lists each rewarded card by name.
- If no card rewards were granted (e.g., failure), the rewards section shows a message or is empty.
- HTML elements for rewards are added to `index.html` and styled in `style.css`.

## Technical Specs
- **File**: `game/client/index.html`
  - Add a `<div id="summary-rewards">` container inside `#run-summary-overlay`, after `#summary-currency` and before the return button.
  - Inside it, add `<div id="summary-rewards-currency">` and `<div id="summary-rewards-cards">`.
- **File**: `game/client/style.css`
  - Style `#summary-rewards`, `#summary-rewards-currency`, `#summary-rewards-cards` to match the existing summary overlay aesthetic.
- **File**: `game/client/main.js`
  - Add DOM references: `summaryRewardsCurrencyEl`, `summaryRewardsCardsEl`.
  - In `showRunSummary(data)`, find the current player's rewards from `data.players` (matching `myId`), and populate the rewards DOM elements with the currency amount and a list of card names.
  - If no rewards or empty cards, show "No card rewards" or similar.
- **File**: `game/client/cards.js` — no changes needed; the server payload already includes card names.

## Verification: code
