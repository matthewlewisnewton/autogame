1. Captured runtime proof is red: `metrics.json` has `"ok": false` because the round-1 fallback capture still asserts old checkpoint/enemy preservation after Telepipe.
   Files: none in `game/` for the failure; capture plan/validation must match the new durable-vitals fresh-redeploy behavior.
   Fix: re-run or update capture to assert HP/Magic Stones persist through Telepipe hub return and redeploy without requiring restored enemy IDs, suspended objective, or checkpoint resume.

2. HP and Magic Stones are not durably persisted, so they reset on cold load instead of lasting "forever".
   Files: `game/server/progression.js`, `game/server/index.js`, `game/server/test/server.test.js`, `game/server/test/integration.test.js`.
   Fix: include `hp`, `dead`, and `magicStones` in persistent player data, restore them in player construction/join paths, and add cold save/load tests for damaged HP and spent Magic Stones.

3. Health is still restored outside the med booth.
   Files: `game/server/simulation.js`, `game/server/progression.js`, `game/server/index.js`, `game/server/test/server.test.js`, `game/server/test/integration.test.js`.
   Fix: remove or redesign auto-respawn and lobby revive HP restoration so only `healAtMedic()` restores health; update affected tests and dead-player return/reconnect behavior.

4. Test coverage is failing in a changed debug-scenario area.
   Files: `game/server/debugScenarios.js`, `game/server/test/debug-scenarios.test.js`.
   Fix: make `arena-trials-boss-approach` pass `debugScenario - arena-trials-* > places player outside dormant boss trigger after adds cleared`; remove/merge duplicate branch logic if needed and rerun coverage.

5. The design doc still describes removed Telepipe checkpoint suspend/resume behavior.
   Files: `game/docs/design.md`.
   Fix: update the Telepipe section to document durable player HP/Magic Stones, hub return, fresh redeploy/no checkpoint restore, and med-booth-only health restoration.
