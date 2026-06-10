# Content: rework crystal_rescue, frost_crossing, training_caverns as scripted PSO-style scenarios

## Difficulty: hard

## Goal

Apply the scripting foundation to three existing quests so each has an authored arc instead of "kill the random pool":

1. training_caverns T1 (Initiate Vault) — guided intro: room-by-room waves with gates, radio lines teaching attack/cards/dodge as each room unlocks. Doubles as the tutorial.
2. crystal_rescue T1 (Prism Salvage) — collecting the FINAL prism triggers a scripted ambush wave at the player's room + an extraction beat ("get back to the entry dock") instead of instant victory. Prisms each fire a radio line.
3. frost_crossing T1 — authored ice-sheet set piece: wave 1 on the stone dock, gate opens to the slippery arena where glacial throwers are positioned at range across the ice (the slow-ball + slippery-floor interaction is the level's identity), finishing with its named rare (autogame-o0vv.4 once available; otherwise a regular miniboss wave).

Each quest gets distinct pacing, at least one gate, and 3+ dialogue beats. Tune so a fresh starter-deck player can clear training_caverns and crystal_rescue solo (see spawn-swarm bug autogame-1btc for frost's current opening problem — the scripted version should fix that pacing by construction).

ACCEPTANCE
- Playing the three quests back-to-back gives three observably different arcs (tutorialized gating / collect-then-ambush-then-extract / ranged set piece on slippery floor).
- No random bulk spawns remain in these three tiers; enemy counts and positions come from the script.
- Playtest each start-to-finish on a fresh account without debug tools.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
