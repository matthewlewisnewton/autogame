# 01 — Training Caverns guided tutorial arc

Rework `training_caverns` tier 1 (Initiate Vault) into a room-by-room PSO-style tutorial: small scripted waves, passage gates that unlock after each clear, and radio lines that teach basic attack, card use, and dodging as the player advances.

## Acceptance Criteria

- Deploying `training_caverns` tier 1 spawns **only** authored scripted enemies (no weighted `enemyPool` bulk placement); opening room starts with a single small wave (≤2 grunts), not a multi-enemy swarm.
- At least **two** `passageLocks` gate forward progress; each lock opens only after its bound room wave clears.
- Scripted encounter spans **at least three** rooms with sequential waves (start room → mid annex → vault wing); final room includes the **Vault Stalker** named rare (`namedRare.displayName === 'Vault Stalker'`).
- **Three or more** distinct mid-run dialogue beats (`dialogueBeacons` and/or `dialogue` entries) whose copy explicitly coaches attack (WASD/melee), playing a card from the hand, and dodging enemy telegraphs — fired on run start, first wave clear, and a later room unlock.
- Enemy totals are solo-clearable on a starter deck (roughly 6–10 authored hostiles across the full run).
- `cd game && pnpm test:quick` passes; `training_caverns_named_rare.test.js` and `tier1_quest_identity.test.js` updated to match the new arc.

## Technical Specs

- **`game/server/quests.js`** — Rewrite `tiers[1].scriptedEncounters` (rooms, waves, `passageLocks`, spawn counts/positions) and `dialogueBeacons` / `dialogue` for tutorial coaching copy. Remove or retire the redundant `script` / `buildTrainingCavernsTier1Script()` dual-spawn path so **only** `scriptedEncounters` drives runtime spawning (passage locks already force `usesScriptedEncounterRuntime`).
- **`game/server/scriptedEncounters.js`** — Reuse existing wave sequencing and `unlockPassagesForWave`; no new engine primitives expected unless a small helper is needed for spawn offsets in deeper rooms.
- **`game/server/test/training_caverns_named_rare.test.js`** — Update deploy expectations (enemy count at start, named-rare room, wave progression).
- **`game/server/test/tier1_quest_identity.test.js`** — Assert passage-lock count, beacon ids, and tutorial-specific dialogue strings.
- **Do not** change `training_caverns` tier 2 or unrelated quests.

## Verification: code
