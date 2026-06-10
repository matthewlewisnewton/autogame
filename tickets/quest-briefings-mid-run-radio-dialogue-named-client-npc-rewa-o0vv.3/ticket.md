# Quest briefings + mid-run radio dialogue: named client NPC, reward shown upfront, scripted progress beats

## Difficulty: hard

## Goal

PSO model: every Guild Quest had a named client with a short briefing at the counter, the reward stated upfront, and mid-run radio chatter / per-step popups (e.g. Native Research printed a confirmation after each required kill type). This is the cheapest way to make identical combat feel like a different mission.

DESIGN
- Data: per quest tier add { client: { name, briefing }, dialogue: [ { trigger: 'run_start' | { waveCleared } | { itemCollected: n } | 'objective_complete', text } ] } in game/server/quests.js.
- Quest board (client): show client name, briefing text, and concrete reward (currency + signature card once that bead lands) before accepting.
- In-run: server emits a dialogue event when a trigger fires; client renders it as a radio/comms line (speaker name + text, auto-dismiss, also into a small log). Reuse the existing toast/banner machinery in main.js where possible.
- Author briefing + 2-3 dialogue beats for ALL existing tier-1 quests as part of this bead (content is the point, not just plumbing).

ACCEPTANCE
- Selecting a quest on the board shows client name, briefing, reward before ready-up.
- During crystal_rescue, collecting each prism fires a distinct radio line; completing the objective fires an extraction line.
- Dialogue events are driven by server triggers (not client timers) so all squad members see them.
- Depends on the quest board actually being usable: bugs autogame-7uv1 / autogame-yb1m.

Can start before autogame-o0vv.1 (run_start/itemCollected triggers do not need the wave system), but waveCleared triggers hook into it once available.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
