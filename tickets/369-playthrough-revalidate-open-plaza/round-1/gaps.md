1. The changed test run is failing: `coverage.log` reports `server/test/debug-scenarios.test.js > arena-trials-boss-approach` with `approachResult.ok` false after non-boss enemies are cleared.
   Files: `game/server/debugScenarios.js`, `game/server/test/debug-scenarios.test.js`
   Fix: make `arena-trials-boss-approach` succeed from a dormant Arena Trials Tier 2 run after cleared adds, then rerun the changed-file coverage/tests.

2. Open-plaza findings omit console/resource oddities even though `console.log` contains `[models] failed to load model "/models/arena-champion.glb"` and repeated `502 (Bad Gateway)` resource errors.
   Files: `game/validation/open-plaza/console.log`, `game/validation/open-plaza/findings.md`, `game/client/models.js`
   Fix: rerun `pnpm validate:open-plaza` against the current live code; if the warnings persist, fix the missing/procedural boss model path, and ensure `findings.md` reports any remaining console/resource oddities.
