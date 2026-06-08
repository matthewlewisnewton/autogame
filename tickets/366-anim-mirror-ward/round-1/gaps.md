1. Mirror Ward's shell remains visible after the ward reflects and is consumed, so the visual lingering effect can outlive the server-side enchantment.
   Files: game/client/cardRenderers.js, game/client/renderer.js, game/server/simulation.js, game/server/index.js
   Fix: track the active shell by caster/player when Mirror Ward is cast, and remove or finish that shell when the `reflectTriggered` Mirror Ward `cardUsed` event is received.
