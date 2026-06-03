# Run the quest-completion smoke to green and commit the evidence artifact

The smoke script and hooks from sub-tickets 01/02 are in the tree, but the QA
playthrough was never actually executed: round-1 fell back to a generic
movement/dodge capture (`scenarios: []`, `runObjectiveComplete: false`) and the
promised evidence under `game/docs/walkthroughs/quest-completion/` does not
exist. Actually run `pnpm test:smoke:quest-completion` end-to-end, fix whatever
prevents it from reaching victory, and commit the resulting state snapshot as
the durable QA evidence for this ticket.

## Acceptance Criteria

- `pnpm test:smoke:quest-completion` (i.e. `node client/scripts/test-quest-completion.mjs`,
  run from `game/`) runs to completion and exits `0`, printing the final
  `PASS: accept → satisfy objective → complete → reward path verified` line. The
  captured run log shows the full flow: server/client up → logged in → run
  started (playing) → `quest-objective-near-complete` scenario applied (ok) →
  objective NOT complete with one enemy → objective flipped to complete via real
  combat → `victory` fired with positive reward currency.
- A committed evidence file `game/docs/walkthroughs/quest-completion/quest-completion-snapshot.json`
  exists in the diff, produced by the green run. Its contents prove the
  completion path fired: `after.runStatus === "victory"`,
  `after.runObjectiveComplete === true`, `lastRunSummary.status === "victory"`,
  the summary objective is complete (`defeatedEnemies >= totalEnemies`), and
  `lastRunSummary.rewards.currency > 0`. (This matches the existing committed
  precedent `docs/walkthroughs/deck-loadout/deck-loadout-snapshot.json`.)
- The `quest-complete.png` screenshot is still written by the script for local
  evidence, but it is NOT expected in the committed diff because
  `game/docs/walkthroughs/**/*.png` is gitignored repo-wide — do NOT force-add it
  or alter `.gitignore` to commit it.
- Any change needed to make the run reliably reach victory is confined to the
  smoke script and/or the 01 hooks' near-complete setup (e.g. making the lone
  grunt reliably killable through the real attack path, lock-on/aim timing, swing
  budget). Do NOT add special-case completion logic that bypasses the real
  `recordEnemyDefeated → checkRunTerminalState → victory` path.
- The script still launches its OWN isolated high-port server + vite
  (`PORT=32xx`, vite `--port 52xx --strictPort`, `ALLOW_DEBUG_SCENARIOS=1`,
  `PERSISTENCE_BACKEND=memory`) and tears down every process it spawns on success
  and failure — no orphaned `node`/`vite` processes remain after the run.
- Existing server + client behaviour is unaffected (the smoke script touches only
  the debug-scenario QA path); the game still starts and loads cleanly via the
  script's own launch.

## Technical Specs

- Run target: `game/client/scripts/test-quest-completion.mjs` (already present
  from sub-ticket 02; wired as `test:smoke:quest-completion` in
  `game/package.json`). Depends on sub-ticket 01's `quest-objective-near-complete`
  debug scenario and the `objective` / `runObjectiveComplete` / `lastRunSummary`
  fields on `window.__AUTOGAME_HARNESS_STATE__`.
- If the real-combat step is the failure point, fix it in
  `test-quest-completion.mjs` (lock-on acquisition, `chooseAttack` slot pick,
  swing/poll budget, or the summon fallback) and/or tighten the near-complete
  enemy setup in `game/server/index.js`'s `quest-objective-near-complete` branch
  so the single grunt is reliably defeated by the player's real opening-hand
  attack (e.g. guarantee a usable weapon, low grunt HP, adjacency within
  lock-on range). Keep completion flowing through the existing real combat path.
- Output dir: `game/docs/walkthroughs/quest-completion/` (the script already
  creates it with `fs.mkdirSync(..., { recursive: true })`). Commit only the
  `quest-completion-snapshot.json` artifact; leave the `.png` uncommitted
  (gitignored).
- Use the project's own teardown that the script already implements; do not
  introduce new long-lived processes.

## Verification: code
