# Client: applyStateDelta (pure)

## Difficulty: medium
## Verification: code
## Depends on: 154-04-delta-envelope

## Goal
A pure function that applies a delta/keyframe message onto a client-side state
mirror. No live-handler wiring in this ticket — just the apply logic + tests
(parallel with the server-side 154-05).

## Acceptance Criteria
- `applyStateDelta(mirror, msg)` → new mirror: `keyframe` REPLACES the mirror;
  a delta MERGES `changed` and drops `removed` ids.
- Returns/﻿flags a seq gap when `msg.baselineSeq` ≠ last applied `seq` (so the
  caller can request a resync) — without throwing.
- Property test: a keyframe followed by a sequence of deltas reconstructs the
  same state as the equivalent full snapshots.

## Technical Specs
- New `game/client/stateApply.js` (pure; imports 154-04). Does NOT touch the
  live socket handler or renderer yet.

## Verification: code
- Unit tests: replace/merge/remove, seq-gap flag, and keyframe+deltas ==
  snapshot reconstruction. `pnpm test:quick` green.
