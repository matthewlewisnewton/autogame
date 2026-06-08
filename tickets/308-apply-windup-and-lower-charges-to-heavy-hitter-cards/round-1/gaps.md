1. Wind-up debug scenarios inject stale pre-rebalance charge counts: `magma-windup-ready` gives Corebreaker Greatsword 4/4 instead of 3/3, and `flame-blade-windup-ready` gives Solar Edge 3/3 instead of 2/2.
   Files: game/server/debugScenarios.js
   Fix: Build these debug hand cards from shared card definitions (`getCardDef`/`CARD_DEFS`) or update their literals to the reduced charges, and add assertions that the scenarios expose `magma_greatsword` at 3 charges and `flame_blade` at 2 charges.
