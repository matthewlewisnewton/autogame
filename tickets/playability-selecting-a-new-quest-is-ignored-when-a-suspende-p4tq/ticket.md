# playability: selecting a new quest is ignored when a suspended run exists — Launch Bay deploy resumes the OLD run instead

## Difficulty: medium

## Goal

Repro from cold start (server: ALLOW_DEV_AUTH=1 ALLOW_DEBUG_SCENARIOS=1 PORT=3310 node index.js; client vite on 5310):
1. Register new account, log in, create lobby (enter hub).
2. Select quest 'training_caverns' t1 on the Contract Terminal and deploy via Launch Bay ready-up. Run starts (objective=defeat_enemies, layout=crowded).
3. Disconnect mid-run (close tab / lose connection). The server suspends the run to lobby (maybeSuspendRun -> suspendRunToLobby when no active players remain; game/server/progression.js:3456).
4. Reconnect (log back in). Select a DIFFERENT quest, e.g. 'crystal_rescue' t1 (objective=collect_items, layout=open), on the Contract Terminal.
5. Deploy via Launch Bay ready-up again.

EXPECTED: deploy crystal_rescue (collect_items / open layout), the quest you just selected.
ACTUAL: you are dropped back into the OLD training_caverns run (defeat_enemies / crowded). The new quest selection is silently ignored.

ROOT CAUSE: game/server/progression.js checkAllReadyInner() (~line 3949): 'if (_gameState.suspendedCheckpoint) { restoreCardCheckpoint(); return; }' — readying up always RESUMES the suspended checkpoint and returns early, never applying the newly-selected quest's layout/objective. To play a different quest the player must first Abort the suspended run (Abort Sortie), but nothing surfaces this; selecting a new quest appears to do nothing.

Also observed: on reconnect the client jumped straight to phase=playing (back in the suspended run) rather than the hub, so the player never gets a clean hub state to pick a new quest. Confirmed via automated Playwright repro at harness/tmp/playqa2/suspendbleed.mjs (two browser contexts: deploy+disconnect, then reconnect+select-different-quest+deploy). Screenshot harness/tmp/playqa2/suspendbleed.png. This is the kind of 'silently re-enters wrong level' confusion that reads as 'not playable'.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
