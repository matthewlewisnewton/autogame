# 233-booth-interaction-primitive

## Difficulty: medium

## Goal

Proximity 'booth zone' interaction system (server+client): walk near a booth anchor + press interact -> emit a named booth action; client shows an interaction prompt. All booths build on this.

## Acceptance Criteria

- 1. Interaction-zone primitive: proximity detection at booth anchors + interact key/click -> named action event. 2. Client prompt when in range. 3. Test for zone enter/exit + action dispatch.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
