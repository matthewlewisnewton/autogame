# Decision: per-quest layouts are fully deterministic — every run of a level is the identical map. Intentional?

## Difficulty: easy

## Goal

Playtest observation (2026-06-09): questLayoutSeed(questId, tier) makes the dungeon seed a pure function of the quest, so every run of e.g. crystal_rescue uses the same map AND the same objective placements (prism positions were identical across all my runs/accounts: (-17,12), (8.7,37.6), (16.8,-21)).

PRO (keep deterministic): authored set pieces (the PSO-style scripted rework, autogame-o0vv) want fixed geometry; players can learn routes; speedrunnable.
CON: replay value — once you know the 3 prism spots, Prism Salvage is a 45-second checklist; PSO itself randomized map block ORDER per run even in scripted quests, keeping reruns fresh while events stayed authored.

DECIDE
(a) keep fully deterministic (document it as a design pillar), or
(b) deterministic geometry + per-run randomized objective/spawn placement (e.g. crystals sample per-run RNG; scripted waves stay anchored to rooms not coordinates), or
(c) small per-run seed variation for non-scripted quests only.

Option (b) is the recommendation: it preserves the scripting foundation while fixing the memorize-the-checklist problem for collect_items.

If (b)/(c) chosen, file the implementation as a follow-up bead under autogame-o0vv. Refs @ commit b4a5bb8: questLayoutSeed in game/server/dungeon.js, spawnCrystals path in game/server/objectives.js.

## Verification

qwen failed (rc=-15)
