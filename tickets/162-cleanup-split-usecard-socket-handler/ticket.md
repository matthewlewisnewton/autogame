# 162-cleanup-split-usecard-socket-handler

## Difficulty: medium

## Goal

game/server/index.js:1514-2376 is a single 862-line socket.on('useCard') closure with ~36 inline 'effect ===' / 'type ===' branches dispatching every card behavior. Sibling useKeyItem (2607-3020, 413 lines) and applyDebugScenario (538-906, 368 lines) are similarly bloated. Ticket 047 extracted simulation/progression but deliberately left the socket handlers in index.js. Branch order is load-bearing and there are no per-effect unit seams, so adding a card means editing the middle of an 800-line function. Strong existing per-effect test suite (astral_guardian.test.js, overclock.test.js, etc.) de-risks the refactor.

## Acceptance Criteria

- Implements the Goal above; the change is scoped to it.
- Existing server + client tests pass; the game starts and loads cleanly.

## Verification

`Verification: code`
