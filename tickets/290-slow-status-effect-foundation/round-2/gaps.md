1. `?debugScenario=slowed-player` creates a slow state that normal gameplay cannot currently reach.
   Files: `game/server/debugScenarios.js`, `game/server/index.js`, `game/server/simulation.js`
   Fix: Remove/withhold the `slowed-player` debug scenario until a real slow-applying card/enemy exists, or add a normal gameplay source that calls `applySlow` through the same server-side combat path so the scenario is only a QA shortcut.
