1. Loaded enemy/minion models float ~halfHeight above the floor instead of
   sitting on the ground. `normalizeLoadedModel` grounds the model to the host's
   LOCAL y=0, but the host mesh is already lifted (enemies to `halfHeight` at
   renderer.js:3175, minions to 0.5 at renderer.js:3348), so the model's feet
   land at world y = the lift, not world y = 0. Floats: grunt +0.5, skirmisher
   +0.3, miniboss +0.9, spawner +0.6, minions +0.5.
   Files: game/client/renderer.js (normalizeLoadedModel ~L291; MODEL_FIT ~L254;
   attachRegistryModel host.add at ~L358).
   Fix: ground each model so its feet reach WORLD y=0 given the host's lift —
   e.g. store a per-key `groundOffset` in MODEL_FIT (halfHeight for enemies, 0.5
   for minions) and set `model.position.y -= (_modelFitBounds.min.y + groundOffset)`,
   or pass the host lift into normalizeLoadedModel. Add an integration assertion
   that an attached model's WORLD-space AABB bottom is ~0 (renderer-model-fit.test.js
   currently only checks the model in its own local space, so it misses this).
