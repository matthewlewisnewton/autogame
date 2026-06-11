1. Rooms boss visual QA depends on a debug-only spawned grunt after Annex Overseer activation, but normal Training Caverns activation clears non-boss enemies, so that end-state is not reachable through normal gameplay.
   Files: game/server/debugScenarios.js, game/server/encounters.js, harness/validate/playthrough.mjs, harness/validate/presets/rooms.mjs
   Fix: remove the post-activation debug add dependency; compare boss visuals against a real reachable add state, or drive/probe a normal gameplay path that reaches the asserted state without debug-only enemy spawning.
