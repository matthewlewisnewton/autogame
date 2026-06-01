# End-to-end bandwidth validation (≥70%)

## Difficulty: medium
## Verification: code
## Depends on: 154-01-permessage-deflate, 154-03-bandwidth-instrumentation, 154-08-client-receive-integration, 154-10-quantize-on-wire

## Goal
Prove the epic hit its target: with delta + deflate + quantization all in, the
many-entity scenario uses ≥70% less `stateUpdate` bandwidth than the
full-snapshot baseline, and the game still plays correctly.

## Acceptance Criteria
- Using the 154-03 instrumentation + load scenario, measured `stateUpdate`
  bytes/sec is **≥70% below** the full-snapshot baseline captured in 154-03.
- The game is fully playable in that scenario (no regression).
- The measurement is repeatable (a script/test prints baseline vs current and
  asserts the threshold).

## Technical Specs
- A measurement test/script driving the 154-03 scenario and comparing
  bytes/sec; no new game behavior.

## Verification: code
- The measurement asserts ≥70% reduction; `pnpm test:quick` green; a manual
  play-through of the scenario confirms no gameplay regression.
