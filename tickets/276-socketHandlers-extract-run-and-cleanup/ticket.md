# 276-socketHandlers-extract-run-and-cleanup

## Difficulty: medium

## Goal

Slice 5: move remaining RUN handlers into server/socketHandlers/runHandlers.js; remove dead buyShopCard/listKeyItems handlers; extract notifyPlayerRemoved() for the 3 copy-pasted leave-broadcasts; connection handler shrinks to building ctx + register calls.

## Acceptance Criteria

- Remaining handlers moved; dead handlers removed; leave-broadcast deduped; connection closure is thin; tests green.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
