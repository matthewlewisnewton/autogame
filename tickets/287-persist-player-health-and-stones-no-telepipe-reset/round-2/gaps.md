1. Durable player HP and Magic Stones are not persisted/restored; cold reconnect/reload resets HP to full and Magic Stones to STARTING_MAGIC_STONES, bypassing the Medic-only healing rule.
   Files: game/server/progression.js, game/server/index.js, game/server/test/persistence.test.js, game/server/test/integration.test.js
   Fix: include hp and magicStones in extractPersistentData(), restore them in buildPlayerRecord()/saved-data refresh paths, and update reconnect/persistence tests to prove partial HP/MS survive saved reloads.

2. Latest server validation is not green: coverage.log reports `server/test/debug-scenarios.test.js > debugScenario — arena-trials-* > places player outside dormant boss trigger after adds cleared` failing because `approachResult.ok` is false.
   Files: game/server/debugScenarios.js, game/server/test/debug-scenarios.test.js
   Fix: make `arena-trials-boss-approach` succeed after adds are cleared while keeping the player outside the encounter trigger and the encounter dormant, then rerun the server coverage/test command.
