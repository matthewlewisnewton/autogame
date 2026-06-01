# Resync handshake (seq-gap → on-demand keyframe)

## Difficulty: easy
## Verification: code
## Depends on: 154-08-client-receive-integration

## Goal
Let a client that detects a baseline/seq gap pull a fresh keyframe, so it
self-heals without waiting for the next periodic keyframe.

## Acceptance Criteria
- When `applyStateDelta` flags a seq gap, the client emits a `requestKeyframe`
  event; the server responds by sending a full keyframe to that socket only.
- A forced gap (drop one delta in a test) → client requests → server keyframes →
  client converges to correct state.
- No effect on the steady-state path when there is no gap.

## Technical Specs
- Client: emit `requestKeyframe` on the gap flag from 154-06/154-08.
- Server (`game/server/index.js`): handler that emits a keyframe to the
  requesting socket.

## Verification: code
- Test simulating a dropped delta → resync request → keyframe → convergence.
  `pnpm test:quick` green.
