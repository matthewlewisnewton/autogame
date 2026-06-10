# Epic: PSO-style quest identity rework — scripted encounters, briefings, named rares, signature rewards

## Difficulty: hard

## Goal

MOTIVATION (playtest 2026-06-09)
5 of 8 tier-1 quests are "purge N hostiles" with randomly pooled spawns, a shared global card-reward rotation (VICTORY_REWARD_ROTATION, game/server/config.js ~48-51 @ b4a5bb8), and near-identical currency (10-20). Quests are distinguishable on paper (layouts, signature enemies) but play identically: walk to the big room, kill N.

RESEARCH: HOW PSO MADE QUESTS FEEL DIFFERENT
Phantasy Star Online reused the exact same combat core and areas for every quest; distinctness came from a thin scripting layer:
1. Hand-placed enemies grouped into WAVES + EVENTS per room (quest .dat data), with doors that unlock only when specific waves are cleared. Encounters were authored, not rolled from a weighted pool.
2. Every Guild Quest had a named client NPC, a briefing at the counter, and the reward stated upfront ("Reward: 2500 Meseta").
3. Mid-run scripted feedback: NPC partners, radio dialogue triggered by progress, per-step popups (e.g. Native Research printed "data collected" after each required enemy type).
4. Unique pulls: named/rare enemy variants tied to specific quests, and quest-exclusive item rewards.

WHAT THIS REPO ALREADY HAS (reuse, don't rebuild)
- Deterministic per-quest layouts + landmarks (dungeon.js questLayoutSeed, LANDMARK_TYPES).
- Encounter config precedent: stage_boss tiers already declare { bossType, landmark, addCount } in quests.js.
- Positional scripted spawning exists in debugScenarios.js (spawnEnemy(x, z, type)).
- survive objective already does timed wave-ish spawning (objectives.js tickSpawns).
- Minion follow/attack AI exists for an escort NPC (simulation.js minion logic).

CHILD BEADS (this epic is the umbrella; see children for acceptance criteria)
Foundation: scripted wave/encounter system; wave-gated doors; briefing + dialogue beacons; named rare variants; per-quest signature rewards. Content: rework crystal_rescue, frost_crossing, training_caverns on top of the foundation; new escort quest type.

DONE WHEN all child beads are closed and at least 3 tier-1 quests play observably differently from each other (different objectives mid-run, different scripted beats, different rewards) rather than "kill N in a different room shape".

NOTE: code refs @ commit b4a5bb8; the factory merges frequently so lines/files may have drifted.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
