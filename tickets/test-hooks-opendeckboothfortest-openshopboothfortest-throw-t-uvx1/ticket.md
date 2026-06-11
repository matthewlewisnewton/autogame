# test hooks: __openDeckBoothForTest / __openShopBoothForTest throw TypeError (missing deps argument)

## Difficulty: easy

## Goal

main.js exposes window.__openDeckBoothForTest = openDeckBooth and window.__openShopBoothForTest = openShopBooth, but those functions are boothCommon openBooth(deps) closures that expect a deps object — calling the hook as documented (no args) throws 'TypeError: Cannot read properties of undefined (reading showGameLobby)' at boothCommon.js:36. Any capture/QA script using these hooks fails; window.showGameLobby() + window.setLobbyTab() is the working workaround. Fix: bind the deps at exposure time (window.__openDeckBoothForTest = () => openBooth(deckDeps)).

## Acceptance Criteria

- Calling window.__openDeckBoothForTest() and window.__openShopBoothForTest() with no arguments opens the respective booth tab without throwing.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
