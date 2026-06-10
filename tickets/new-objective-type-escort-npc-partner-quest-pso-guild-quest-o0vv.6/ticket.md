# New objective type: escort/NPC partner quest (PSO Guild Quest staple)

## Difficulty: hard

## Goal

PSO model: a large share of Guild Quests were "citizen lost in the field / needs a bodyguard" — an NPC partner walks with you and the quest is about protecting someone, not just clearing.

DESIGN
- New OBJECTIVE_DEFS entry 'escort' (game/server/objectives.js @ b4a5bb8): NPC spawns at an authored point, follows the nearest player (reuse the existing minion follow/hold AI in simulation.js), can be damaged by enemies; objective completes when the NPC reaches the extraction landmark alive; run fails if the NPC dies.
- Enemies should weight the escort as a target (taunt-minion targeting precedent exists in simulation.js).
- Scripted ambush waves along the route via autogame-o0vv.1; dialogue lines from the escort via autogame-o0vv.3 ("They found us!").
- Content: one new tier-1 quest using it (e.g. 'Lost Surveyor' in the sunken-canyon profile).

ACCEPTANCE
- Escort NPC follows, takes damage, has a visible HP bar.
- Reaching extraction with NPC alive = victory; NPC death = run failed with a distinct summary reason.
- Ambush waves trigger at authored route points.

## Verification

claude_fable failed (rc=-15)
