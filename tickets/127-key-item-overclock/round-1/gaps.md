1. Unused overclock charges do not expire on run end and can carry into the next deployment.
   Files: `game/server/progression.js`, `game/server/index.js`
   Fix: clear `overclockChargesRemaining` for all players when a run reaches victory/failure or is abandoned/returned, and before starting a fresh non-suspended run; add regression tests for terminal run and redeploy behavior.
