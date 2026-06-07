## Remove Unrelated Production Null Guards

The ticket scope is validation driver plus validation outputs, but `game/client/main.js` still carries two production-side null guard changes around `lobbyEl.classList.add('hidden')`. They are harmless, but keeping the ticket focused on validation-only changes makes future reviews easier.

### Acceptance Criteria
- Either revert the unrelated `game/client/main.js` null guard changes or document why they belong in a separate production-code ticket.
