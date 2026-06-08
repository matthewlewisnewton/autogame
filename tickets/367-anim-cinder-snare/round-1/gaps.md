1. Cinder Snare's ember/DoT pulse timing starts on trap placement, but the server starts the actual DoT only later when an enemy triggers the snare.
   Files: game/client/cardRenderers.js, game/server/cardEffects.js, game/server/simulation.js, game/server/progression.js
   Fix: emit or expose the server-side cinder-snare trigger/area-effect creation and start the client DoT pulse cadence from that trigger, not from the placement cardUsed event.
