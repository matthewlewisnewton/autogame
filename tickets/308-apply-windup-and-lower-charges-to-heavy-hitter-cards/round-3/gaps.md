1. The normal card render does not tell players Solar Edge or Corebreaker Greatsword have a heavy wind-up/commit lockout.
   Files: game/client/main.js, game/shared/cardDefs.json, game/client/test/main.test.js
   Fix: Surface the affected cards' `description` or `windUpMs` warning in player-facing card UI (at minimum the in-run hand render, and any deck/evolution view that shows card text) and add client tests that the warning is rendered for both cards.
