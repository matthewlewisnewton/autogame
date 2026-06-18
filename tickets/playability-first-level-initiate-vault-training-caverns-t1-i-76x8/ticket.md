# playability: first level (Initiate Vault / training_caverns t1) is near-unwinnable from cold start — player dies in room 0 before killing a single grunt

## Difficulty: medium

## Goal

COLD-START REAL-FLOW REPRO (no debug-scenario deploy):
1. Start server (game/server: ALLOW_DEV_AUTH=1 ALLOW_DEBUG_SCENARIOS=1 PORT=3300 node index.js) + vite client (port 5300).
2. Cold-load http://localhost:5300 — loads fine, auth overlay shows.
3. Register + login a NEW account through the lobby. Works.
4. Click Create Lobby -> enter 3D hub (phase=lobby, layout=hub). Works.
5. Walk (WASD) to the Launch Bay booth (anchor ~(-16,4)); prompt 'Press F — Launch Bay' shows; press F. Deploys into training_caverns tier 1 (the DEFAULT quest), objective 'Initiate Vault' defeat_enemies 6 total. Works.
6. PLAY THE FIRST FIGHT: player spawns in start room at (-9,27). Two grunt enemies (hp=100 each, attackDamage=10) spawn 'towardPassage' at ~(-9,22-23), only ~5 units away. After the 3s aggro grace they converge to ~4 units (their attack range) and grind the player down.

EXPECTED: a new player with the starter deck (iron_sword 17 dmg / flame_blade 28 / battle_familiar 44) can clear the first room and progress.
ACTUAL: The first fight is effectively unwinnable for a new player.
  - An IDLE player (no input) drops 100->0 HP and DIES in ~12s (measured every 1s: 100,100,100,80,80,60,60,40,40,20,20,0).
  - Driving REAL combat without godmode (lock-on 'z' + weapon attack on number keys + close/retreat kiting), across multiple automated attempts, the player DIED with defeatedEnemies=0/6 every time — best case got ONE grunt to 15hp before dying. Two 100-HP grunts out-damage a 17-dmg starter sword (6 hits/grunt) while dealing 10 dmg/hit in melee.
  - With godmode enabled, the SAME combat code clears all 6 enemies and completes the level (deploy->room0->room1->room2->VICTORY->return to hub), proving attacks land but the player cannot survive the damage race.

This is almost certainly what the owner hit ('tried to play, NOT PLAYABLE'); prior automated tests passed because they deployed via debug scenarios with godmode and never fought the real first room cold.

CONTEXT: There is a prior balance ticket (commits 8085a168, 57d2c46a 'balance-initiate-vault-spawn-camps-the-player-20-hp-lost-in...') that repositioned the entry grunts and added a 3s aggroGrace. That fix only prevents chip damage DURING intro dialogue — it does NOT make the post-grace fight survivable. The first room still spawn-camps the player.

NON-blocking caveat: my automated combat AI is cruder than a human; whether a highly skilled human can win by perfect kiting is uncertain, but (a) idle death in 12s, (b) 0/6 across several kiting strategies, and (c) NO default dodge key bound (see related bug) make this the first hard blocker to real progression. Difficulty: medium (likely a balance/tuning fix — grunt HP/count, starter weapon damage, or spawn distance).

ARTIFACTS: harness/tmp/playqa1/ (drive.mjs cold-start->deploy proof, play2.mjs godmode full-clear proof, spawn-probe.mjs idle-death trace, fight-probe.mjs/kite2.mjs no-godmode combat deaths, screenshots 01..07 + full-L1.png).

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
