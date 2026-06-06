1. Round-3 capture produced no runnable proof: `metrics.json` has `ok:false`,
   `failure_kind:capture_failed`, empty `screenshots`/`probes`, and the game server
   dropped mid-capture (`client.log` ECONNREFUSED 127.0.0.1:3003 → `console.log` four 502s →
   `page.waitForFunction` timeout). `capturePlanSource` is `fallback` (the generic solo
   suspend/resume plan ran despite the intended exclusion).
   Files: harness/screenshot.mjs, harness/validate/playthrough.mjs, harness/validate/lib/telepipe.mjs, harness/validate/presets/hub.mjs
   Fix: make the ticket-281 hub capture reach a stable playing/suspended/fresh-deploy state
   without losing the server socket (ensure the hub exclusion from suspend/resume actually
   applies), then re-run until `metrics.json` is `ok:true` with the required screenshots/probes.

2. Out-of-scope gameplay regression introduced to stabilize a probe (scope is
   harness/validate/** + validation/** only). `regenMagicStones()` now skips passive
   magic-stone regen for fresh deploys (magicStones===STARTING_MAGIC_STONES && !hasSpentMagicStonesThisRun),
   altering balance for every run; the `hasSpentMagicStonesThisRun` field is threaded through
   multiple server files. Also `showExtractedLobbyOverlay()` early-returns for solo squads,
   RUN_ABANDONED/RUN_SUSPENDED force isReady=false, and a `#112233` palette color was added.
   Files: game/server/simulation.js, game/server/progression.js, game/server/index.js, game/server/cardEffects.js, game/server/keyItemEffects.js, game/client/main.js, game/client/cosmeticForm.js
   Fix: revert the live gameplay/behavior/content changes; achieve probe stability inside the
   harness (sample MS deterministically, e.g. read the value before regen ticks or via a
   test-only read path) without modifying regen, run-state, overlay, or palette behavior.

3. Hub validation artifacts are inconsistent and fail the verifier. Latest
   `run-summary.json` has `steps:"telepipe-reset"` with only `telepipeUpReset` in
   `assertions`, while `findings.md` claims all three asserts PASS (boothDeductsGold,
   hatSwapFree, telepipeUpReset) — an overstated/faked pass. `verify-hub-artifacts.mjs`
   requires `steps:"full"` plus all three keys, so `validate:hub:check` fails.
   Files: game/validation/hub/run-summary.json, game/validation/hub/findings.md, harness/validate/playthrough.mjs, harness/validate/verify-hub-artifacts.mjs
   Fix: regenerate the full `--steps full` run so run-summary.json carries all three
   assertions, and rewrite findings.md from that same run so it matches the artifacts.
