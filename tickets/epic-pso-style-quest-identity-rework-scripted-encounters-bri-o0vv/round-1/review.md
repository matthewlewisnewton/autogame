# Review — Epic PSO-Style Quest Identity Rework

## Runtime health

PASS. The captured run in `metrics.json` reports `"ok": true`, the game reached `playing`, both clients connected, a canvas was present, and the fallback smoke flow exercised auth, lobby deploy, movement, and key-item cooldown. `pageerrors` is empty and `console.log` contains no `pageerror` or `[fatal]` lines from game code. Server/client logs show expected startup/shutdown noise only.

## Acceptance Criteria Findings

### Scripted wave encounter foundation

PASS. `game/server/quests.js` defines `scriptedEncounters` with documented room/wave/spawn metadata, including room index, landmark, band, offsets, anchors, named rares, and passage locks. Scripted quests skip bulk combat spawning through objective hooks, initialize only the start-room wave on deploy, advance waves through tagged enemy ids, and preserve/relink scripted state through checkpoint suspend/resume. Coverage includes `scripted_encounters.test.js`.

### Wave-gated passage unlocks

PASS. `run.passageLocks` is initialized from quest config, locked passage barrier AABBs are injected into server and client wall colliders, wave clear unlocks rebuild collision, and state updates carry lock changes to clients. The server tests verify locked movement rejection, unlock behavior, and no earlier-wave respawns.

### Quest briefing and mid-run dialogue

PASS. Quest tiers now carry `clientNpc`, `briefing`, objective/reward summaries, and dialogue beacons. Quest-board payloads include the briefing fields, the client renders an NPC briefing/reward panel, and `questDialogue` events display mid-run toasts. Dialogue triggers cover wave clear, crystal collection, and room entry with per-run beacon dedupe. The progression emit path uses a lobby-scoped broadcast target via `getIoTarget()`, so normal multi-lobby isolation is preserved.

### Named rares and signature rewards

PASS. Scripted spawns can assign `namedRare` display names and forced variants, `spawnEnemy` honors display/variant options without changing normal spawns, and lock-on/boss labels prefer the display name. Quest `rewardCardId` values are valid reward-acquisition cards and are granted before the global victory rotation when no card-choice drops exist. Reward summaries include the named card plus currency.

### Escort objective

PASS. The `escort` objective type is registered with enemy progress, destination completion, failure on escort death, and no bulk combat spawn. `annex_escort` provides a tier-1 content showcase using Archivist Vale, scripted ambush waves, a treasure-room destination, briefing, dialogue, and a signature reward. Escort state is included in checkpoints and the minion follow branch keeps it in normal simulation rather than a parallel debug-only path.

### Tier-1 quest identity content

PASS. The three primary tier-1 quests now play differently in their normal quest-board/deploy flow:

- `training_caverns` / Initiate Vault is a scripted annex sweep with a passage lock, wave-clear dialogue, Vault Stalker named rare, and Saber of Light reward.
- `crystal_rescue` / Prism Salvage keeps prism collection but requires scripted guard waves and fires collection dialogue for each prism, with Mana Prism as the stated reward.
- `frost_crossing` has ice-band waves, glacial throwers, Rimecast the Slow as a named rare, room-entry ice-band dialogue, and Cryo Burst as the reward.

The design doc's Quest identity section matches this implementation, and the original foundation requirements still hold: the captured run renders 3D, connects over WebSocket, shows multiplayer state, and synchronizes movement.

### Debug scenarios

PASS. This ticket added tier-1 deploy shortcuts for the reworked quests. They are debug/dev gated: the client only auto-requests them from the `?debugScenario=` URL on localhost, and the server rejects debug scenarios outside localhost/dev or `ALLOW_DEBUG_SCENARIOS=1`. Equivalent states remain reachable through normal gameplay by selecting the quest, readying/deploying, and then progressing through authored waves/items/escort objectives. The shortcuts mutate QA state only after the debug event and do not replace the normal validation path.

## Verification

- Captured run: `metrics.json` ok, `pageerrors: []`, no fatal browser page errors.
- Harness probes: lobby deploy to playing, objective visible, two players present, enemies spawned, card hand visible, key-item cooldown probe succeeded.
- Coverage log: 155 test files passed, 2368 tests passed; coverage report present with thresholds disabled.

## Remaining gaps

No blocking gaps.
VERDICT: PASS
