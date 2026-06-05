# 230-hub-client-render

## Difficulty: medium

## Goal

Render the hub stage via the existing world-stage renderer and spawn the local avatar in it during the lobby phase.

## Acceptance Criteria

- 1. Client renders the 'hub' layout (reuse renderer). 2. Local player avatar spawns + is visible in the hub during gamePhase==='lobby'. 3. No console errors; walkable.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
