# 287-persist-player-health-and-stones-no-telepipe-reset

## Difficulty: hard

## Goal

OWNER DECISION (2026-06-06): player state should ALWAYS persist — NO suspend/resume checkpoint logic. A players health and magic stones persist continuously (across telepipe-up to the hub, redeploy, and between sorties — "forever"); health is restored ONLY at the med booth (the hub Medic station).

CURRENT BEHAVIOR (found by hub validation 281): telepipe-up mid-level starts a FRESH run on redeploy — magic stones reset (15->49), new runId, suspendedCheckpoint NOT restored (game/validation/hub/run-summary.json: telepipeUpReset=true, freshRunIdConfirmed=true, checkpointRestoredInLog=false, suspendedRunSummary=null). This loses run progress.

CHANGE TO:
1. Telepipe-up to the hub must NOT reset the players health or magic stones. Going to the hub and redeploying PRESERVES them.
2. REMOVE the suspend/resume checkpoint machinery (captureRunCheckpoint / restoreRunCheckpoint / suspendedCheckpoint / suspendRunToLobby reset) in favor of DURABLE player state: health + magic stones live on the player and persist across lobby<->sortie transitions and across runs. No "resume logic" — state is simply continuous.
3. resetTransientRunState() (and the suspend-to-lobby path) must STOP clearing health / magic stones.
4. The ONLY thing that restores health is the MED BOOTH (Medic station) in the hub — confirm/implement med-booth healing of the persistent health.

ACCEPTANCE:
- A player with e.g. 15 magic stones and partial health takes telepipe-up, returns to hub, redeploys -> still has 15 stones and the same health (no reset; continuous state).
- Visiting the med booth restores the players health.
- No fresh-run-on-redeploy; runId/state continuity preserved (or runId no longer implies a state wipe).
- Server tests: telepipe-up -> redeploy preserves health + magic stones; med booth heals.

OUT OF SCOPE / OPEN: CARD usage/charge persistence is NOT decided here — keep current card-charge behavior unchanged unless a separate decision says otherwise.

SCOPE: game/server/progression.js (suspend/deploy/reset paths), game/server (player state + med booth), game/server/test; minimal client only if MS/health display needs it.

## Verification

merge rejected: post-rebase verification failed
