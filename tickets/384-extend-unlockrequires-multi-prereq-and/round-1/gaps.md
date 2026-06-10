1. Evaluated multi-prereq unlock state is not consistently exposed or consumed by quest payloads.
   Files: game/server/quests.js, game/server/index.js, game/client/questBoard.js, game/client/main.js
   Fix: make the authoritative account-scoped quest payload expose evaluated unlock state on every lobbyJoined/questUpdate/lobbyUpdate path, and have the client lock tier cards from that evaluated state instead of the raw persisted unlockedQuestTiers map.
