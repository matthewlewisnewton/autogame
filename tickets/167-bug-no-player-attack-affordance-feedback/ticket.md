# 167-bug-no-player-attack-affordance-feedback

## Difficulty: medium

## Goal

During QA playthrough, the player could only damage enemies by walking into them (contact). Clicking the canvas produced nothing, and there is no visible attack input, animation, reticle, or hit feedback for the player's own offense -- a new player has no cue how to attack. (Player/enemies also render as placeholder cubes, acceptable for prototype.) Scope: surface a clear basic-attack affordance and hit feedback for the player.

## Acceptance Criteria

- Implements the Goal above; the change is scoped to it.
- Existing server + client tests pass; the game starts and loads cleanly.

## Verification

`Verification: visual`
