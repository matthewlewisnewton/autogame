# Senior Review — playability: first level (Initiate Vault / training_caverns t1)

## Runtime health (gate)
- `metrics.json`: `ok: true`, `capturePlanValid: true`, `pageerrors: []`, no `harness_failure` block.
- `console.log`: only benign noise — 401 before auth, a transient WS-closed warning, 409 on the
  second player's lobby create race, then clean `initScene` + `ready-up via booth`. No `pageerror`
  / `[fatal]` lines from game code.
- Captured probe confirms the player deployed into `training_caverns` t1, objective
  `Initiate Vault` `defeat_enemies` total 6, real flow (`debugScenario: null`), and **survived the
  opening fight at 86/100 HP**. The game starts and loads cleanly. Gate PASSED.

## Per-criterion findings

The top-level ticket frames the blocker concretely: a cold-start, real-flow player with the starter
deck dies in **room 0** before killing a single grunt because two 100-HP / 10-dmg grunts spawn ~5
units away and out-damage a 17-dmg starter sword. EXPECTED: a new player can clear the first room and
progress.

**1. First room is survivable / winnable with the starter deck — MET.**
The fix adds a per-spawn stat override path (`spawnEnemy` in `progression.js`, plumbed through
`spawnScriptedWave` in `scriptedEncounters.js`) and applies it to the two room-0 wave-0 grunts in
`quests.js`: `hp: 50` (was 100) and `attackDamage: 7` (was 10). The captured run shows both grunts
spawning at `hp: 50, maxHp: 50` and the player surviving the opening exchange (86 HP). The new
regression test `training_caverns_room0_starter_fight.test.js` drives **real combat** (no godmode):
kiting AI closes, swings `iron_sword`, retreats during enemy windups, and asserts the player ends
alive with HP > 0, both wave-0 grunts dead, `defeatedEnemies >= 2`, and passage lock 0 unlocked.
Test passes. This directly converts the ticket's "0/6, dies every time" failure into a proven clear.

**2. Change is correctly scoped — MET.**
`grep` confirms only the two room-0 wave-0 grunts carry the override; all other waves/rooms keep
default grunt stats (hp 100), so the rest of the level retains its intended difficulty and the
objective count is unchanged (`countAuthoredScriptedEnemies` still 6–10, asserted in
`tier1_quest_identity.test.js`). The override guards are defensive (`Number.isFinite && > 0`) and
applied after variant scaling, so they cleanly win without corrupting non-overridden spawns.

**3. No debug-scenario shortcut introduced — MET.**
The repro and capture both run the genuine cold-start flow; `debugScenario` is `null`. No new
`?debugScenario=` entry point was added, so the debug-scenario invariants do not apply.

**4. Consistency with design / no regression — MET.**
`design.md` describes Initiate Vault as a scripted annex sweep with passage locks and a 6-enemy
sweep objective — all preserved. `tier1_quest_identity.test.js` was updated to match the new spawn
defs and still asserts quest identity, objective wiring, and authored enemy count. Full server
identity + fight suite: 9/9 passing.

**5. Code quality — MET.**
The override is a small, well-documented addition (JSDoc on the `@property` entries). No dead code,
no console errors, no obvious bugs. The regression test is thorough and deterministic (fake timers,
fixed seed).

## Remaining gaps
None. The captured run is clean, the opening fight is now survivable in real flow, and a real-combat
regression test locks in the clear. Rooms 1–2 retain default grunt stats by design; the ticket's
blocker was specifically the room-0 spawn camp, which is resolved.

VERDICT: PASS
