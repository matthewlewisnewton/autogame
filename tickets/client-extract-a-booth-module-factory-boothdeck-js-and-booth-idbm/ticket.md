# Client: extract a booth module factory — boothDeck.js and boothShop.js are line-for-line copy-paste

## Difficulty: easy

## Goal

game/client/boothDeck.js:1-59 and game/client/boothShop.js:1-59 are identical modulo deck/shop naming: same shouldOpenDebug*Booth, createRequestDebug*BoothOpener, open*Booth (showGameLobby -> setLobbyTab -> render), register*BoothListener with a module-level listenerRegistered flag. A third variant lives in questBooth/launchBooth; the next booth will be a fourth copy. Fix: one createBoothModule({ boothId, tab, render }) factory in boothPrompt.js or a new boothCommon.js; existing exports become two-line instantiations. Found in code review 2026-06-09.

## Acceptance Criteria

- A single booth factory backs boothDeck/boothShop (and ideally questBooth/launchBooth); public exports unchanged; existing booth tests pass

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
