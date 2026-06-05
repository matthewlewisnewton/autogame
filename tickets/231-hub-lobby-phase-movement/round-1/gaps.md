1. Returning from a run to lobby can leave the client on stale dungeon geometry instead of rebuilding the hub.
   Files: game/client/main.js, game/server/progression.js
   Fix: send or preserve the full hub layout for lobby re-entry before `restoreHubLobbyScene` runs, avoid overwriting the incoming lobby snapshot with the old `currentLayout`, and add a client test for playing -> lobby rebuilding `profile: 'hub'`.
