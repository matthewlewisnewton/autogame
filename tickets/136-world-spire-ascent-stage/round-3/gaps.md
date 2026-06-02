1. The `spire-ramp-passage` and `spire-summit-combat` debug scenarios can start from the current/default quest while swapping to spire geometry, so their run objective and enemy setup are not equivalent to normal `spire_ascent` gameplay.
   Files: `game/server/index.js`
   Fix: In `applyDebugScenario()`, set `state.selectedQuestId = 'spire_ascent'` and apply the spire quest layout before `enterPlayingPhase()` for both spire scenarios, then position the player on the ramp/summit after the normal spire run/enemy setup is created.
