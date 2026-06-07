1. Party-mate presence is not visually confirmed: every hub screenshot (01-04)
   shows only the host avatar. The overview is taken right after both players
   spawn yet frames only the host; the room shots follow the host to far zones
   with the joiner out of frame. The ticket explicitly requires "the 2
   party-mates visible in-world". (NOTE: this is a framing problem, NOT party
   size — the 2-player party host+joiner is correct; do NOT add a third player.)
   Files: harness/validate/playthrough.mjs (runHubWalkStep), harness/validate/lib/multiPlayer.mjs,
   game/validation/hub/01-hub-overview.png (+ run-summary.json, findings.md, probes.json after rerun)
   Fix: Before capturing 01-hub-overview (or in a dedicated shot), position the
   host so the joiner's avatar is in frame (e.g. move host adjacent to the
   joiner spawn / point the camera to include both), confirm the remote
   squadmate avatar actually renders in the host's 3D view, then rerun hub
   validation so at least one screenshot shows both party members in-world with
   the menu dismissed.
