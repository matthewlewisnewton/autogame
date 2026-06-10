1. Astral guardian minions still melee every simulation tick (~50ms interval) instead of a configured >=1000ms interval.
   Files: game/shared/cardStats.json, game/server/progression.js, game/server/cardEffects.js, game/server/simulation.js, game/server/test/astral_guardian.test.js
   Fix: Add `"attackIntervalMs": 1500` (or 1000–2000) to `astral_guardian` in cardStats; remove/replace the one-tick `CARD_STAT_OVERLAY.astral_guardian` entry; change the generic spawn default in cardEffects (line ~208) and the guardian-branch fallback in simulation.js (~2893) to use >=1000ms when cardStats is absent; update astral_guardian tests to expect the new interval and add a double-tick regression test like mauler.

2. Guardian spawn path still hard-codes one-tick `attackIntervalMs` via overlay and factory defaults (affects aegis_sentinel consistency even though attackDamage is 0).
   Files: game/shared/cardStats.json, game/server/progression.js, game/server/cardEffects.js
   Fix: Add `attackIntervalMs` to `aegis_sentinel` in cardStats (same 1500ms default as astral_guardian) and ensure spawned minions inherit it instead of `Math.floor(1000 / TICK_RATE)`.
