# 244-canyon-walkability-fixes

## Difficulty: medium

## Goal

Fix two real sunken-canyon stuck bugs found in playtest. (a) The 3 descent ramps overlap, producing side-walls 0.5u apart at x~=+-2 where the player WEDGES solid. (b) Ramps only span x in [-5.5,5.5] so a player at the canyon edges gets pinned against the north wall, unable to climb out.

## Acceptance Criteria

- 1. Dedupe/merge overlapping ramp side-walls so no two walls sit < player width apart (kills the x~=+-2 wedge). 2. Widen rampWidth (4->6) or make adjacent ramps one contiguous descent. 3. Add side/return ramps or widen the canyon north-wall gap so edge players can ascend. 4. Flood-fill reachability test + a walk test proving plateau<->canyon both ways with no wedge.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
