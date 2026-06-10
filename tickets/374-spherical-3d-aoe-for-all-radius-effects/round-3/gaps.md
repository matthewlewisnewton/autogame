1. Freshly spawned flying enemies/minions can be evaluated at floor height by AoE/radius checks until the first update tick initializes `y`.
   Files: `game/server/simulation.js`, `game/server/progression.js`, `game/server/cardEffects.js`
   Fix: make `getEntityWorldY()` honor `flying` / `altitude` when `y` is absent, or initialize `y` at enemy/minion spawn, and add regression tests that run AoE/radius checks against spawned flying entities before any update tick.
