1. The quest-completion QA playthrough is not evidenced: `round-1/metrics.json` used the fallback movement/dodge capture (`scenarios: []`), stayed `runObjectiveComplete: false`, and no quest-completion screenshot/snapshot artifacts exist.
   Files: game/client/scripts/test-quest-completion.mjs, game/docs/walkthroughs/quest-completion/
   Fix: run/fix `pnpm test:smoke:quest-completion` so it completes the quest, observes victory/rewards, and writes `quest-complete.png` plus `quest-completion-snapshot.json`; include those artifacts in the review round.

2. The existing test gate is not proven clean because `round-1/coverage.log` ends with `[vitest] timed out after 120s - killing process group` before the suite completes.
   Files: game/scripts/run-vitest.mjs, game/server/test/key-items.test.js
   Fix: make the full `pnpm test`/coverage run complete within the harness budget or otherwise provide a clean passing server+client test run for this ticket.
