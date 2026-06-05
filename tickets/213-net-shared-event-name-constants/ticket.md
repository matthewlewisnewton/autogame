# 213-net-shared-event-name-constants

## Difficulty: medium

## Goal

~40 server emit names + ~25 client emit names are magic strings duplicated string-for-string across game/server/{index,progression,cardEffects,keyItemEffects,debugScenarios}.js and game/client/main.js with nothing enforcing they match (e.g. dynamic emit of runComplete/runFailed at progression.js:3198 must match client s.on at main.js:1411-1412). A rename/typo silently drops messages.

## Acceptance Criteria

- 1. Add game/shared/events.json (or .js) exporting canonical event names; import on both sides (shared/ is already cross-imported). 2. Replace literals incrementally. 3. Add a test asserting every server-emit and client-on name resolves to a shared constant (drift guard).

## Verification

SIMPLICITY/drift-prevention. Mechanical but broad — sequence AFTER the handler extraction (210). Risk: a missed literal = dropped event; the coverage test catches it.
