# Server: quest-objective crystals despawn after LOOT_LIFETIME_MS — collect_items runs unwinnable after 2 minutes

## Difficulty: easy

## Goal

Found while playtesting Prism Salvage / crystal_rescue (2026-06-09). Verified both directions:
- Run lasting > 2 min: stuck at 2/3 prisms; standing exactly on the third crystal's spawn point (16.8, -21.0; well inside LOOT_PICKUP_RADIUS 3.5) picked up nothing. Objective permanently incompletable, zero feedback to the player.
- Fresh run beelining all 3 crystals in 44s: collected 3/3, victory.

CAUSE
The game-loop loot cleanup filters ALL loot by age with no exemption for quest-critical items:

game/server/index.js ~line 1510 (commit b4a5bb8):
  state.loot = state.loot.filter(l => (now - l.createdAt) < LOOT_LIFETIME_MS);

LOOT_LIFETIME_MS = 120000 (game/server/config.js ~line 40). Objective crystals are spawned into state.loot (spawnCrystals via objectives.js collect_items spawnQuestEntities), so they expire like ordinary drops 2 minutes after run start.

REPRO
1. Start crystal_rescue (Prism Salvage, 3 prisms).
2. Collect 0-2 prisms, then idle until run clock passes 2:00.
3. Walk onto a known remaining crystal position (server log prints spawn coords) — nothing is collected; objective counter frozen; run can never reach victory.

FIXED WHEN
Quest-objective items never expire (e.g. skip kind === 'crystal' / objective-flagged loot in the lifetime filter), and a >2-minute crystal_rescue run can still be completed. Bonus: a regression test that advances the clock past LOOT_LIFETIME_MS and asserts crystals remain.

NOTE: refs at commit b4a5bb8; line numbers may drift — search for LOOT_LIFETIME_MS in index.js.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
