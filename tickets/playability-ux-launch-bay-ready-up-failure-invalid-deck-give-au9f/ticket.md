# playability/ux: Launch Bay ready-up failure (invalid deck) gives NO visible feedback — error written to hidden deck-editor panel

## Difficulty: medium

## Goal

REPRO (code-confirmed path): in the hub, walk to the Launch Bay booth and press F (or click prompt) to ready-up/deploy while your selectedDeck is invalid (below DECK_MIN_SIZE=4, e.g. you removed cards). Client emits PLAYER_READY; server (game/server/socketHandlers/deckHandlers.js ~line 245) runs validateDeck and on failure emits DECK_ERROR with a reason. Client handler (game/client/socketHandlers/lobbyHandlers.js line 59-62) calls ctx.showDeckError(reason).

BUG: showDeckError (main.js line 3091) writes the message into #deck-error, which lives inside #deck-editor inside #lobby (index.html line 138/163/174). That whole subtree is hidden unless the player has the deck editor open. So when ready-up is triggered from the Launch Bay BOOTH (deck editor closed), the failure message is written into a hidden element and the player sees absolutely nothing happen. The client even logs '[launchBooth] ready-up via booth' as if it succeeded.

IMPACT: classic 'I pressed the deploy button and nothing happened' dead-end. Also note launchBoothReadyUp() sets client-side isReady=true locally before the server rejects, creating a client/server ready desync (server set player.ready=false). A new account is shielded because it ships a valid 8-card starter deck, but anyone who edits their deck below minimum hits a silent wall.

EXPECTED: pressing F at Launch Bay with an invalid deck should surface a clear, on-screen message (toast/booth-prompt) like 'Deck too small — open the Deck booth (need 4+ cards)'. ACTUAL: no visible feedback; #deck-error stays display:none because its container is hidden.

Verified via Playwright: when ready-up fired with deck shown as 0/0, the only on-screen text was an unrelated quest-comms toast; #deck-error was display:none/offsetParent null. Screenshots: harness/tmp/playqa3/40-launchbay-emptydeck-F.png.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
