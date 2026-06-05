1. Players who leave during `gamePhase === 'playing'` remain in `lobby.hubPresence.players`, so they can reappear as ghost hub avatars when the lobby returns to hub phase.
   Files: `game/server/index.js`, `game/server/hubPresence.js`
   Fix: Remove hub presence on all player removals regardless of phase, and/or make `buildHubPresenceUpdate()` skip entries missing from `lobby.state.players`; add a regression test for mid-run leave followed by return to lobby.
