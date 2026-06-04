1. Full server+client vitest is not green: `pnpm test` exits 137 after a full-suite `loot_magnet` failure (`expected result.pulled 1, got 0`), and `pnpm test:quick` exits 137 even after printing a green summary.
   Files: game/server/test/loot_magnet.test.js, game/scripts/run-vitest.mjs, game/vitest.config.js
   Fix: Stabilize the suite/runner so `pnpm test` and `pnpm test:quick` complete with exit code 0; investigate the full-suite-only loot magnet race and the post-summary SIGKILL.
