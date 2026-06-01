# Delta wire envelope (shared contract)

## Difficulty: easy
## Verification: code
## Depends on: none

## Goal
Define the shared message envelope both server and client will use for delta
sync, so the server-side and client-side work can proceed in parallel against a
fixed contract. No behavior change yet.

## Acceptance Criteria
- A shared module documents the envelope:
  `{ seq:int, baselineSeq:int, keyframe:bool, changed:{players,enemies,minions,loot,...}, removed:{<kind>:[ids]} }`
  with JSDoc/types, plus constants (`KEYFRAME_INTERVAL_TICKS`, message event
  name(s)).
- Importable by both `game/server` and `game/client`; nothing else changes.

## Technical Specs
- New `game/shared/stateSync.js` (envelope shape + constants + tiny helpers like
  `isKeyframe(msg)`), with a trivial test that the constants/types load.

## Verification: code
- Server and client can both import the module; `pnpm test:quick` green.
