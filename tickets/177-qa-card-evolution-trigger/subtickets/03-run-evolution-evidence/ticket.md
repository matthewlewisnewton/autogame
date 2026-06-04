# Run the card-evolution smoke to green and commit the evidence artifact

The smoke script and hooks from sub-tickets 01/02 are in the tree, but the QA
playthrough needs to be executed: run `node client/scripts/test-card-evolution.mjs`
end-to-end, fix whatever prevents it from reaching a clean evolution, and commit
the resulting state snapshot as the durable QA evidence for this ticket.

## Acceptance Criteria

- `node client/scripts/test-card-evolution.mjs` (run from `game/`) runs to
  completion and exits `0`, printing the final success line. The captured run
  log shows the full flow: server/client up → logged in → lobby entered →
  `evolution-ready` scenario applied (ok) → `skeleton_knight` at `+10` grind
  found in inventory → `__evolveCardForTest` returns `ok: true` with
  `fromCardId: 'skeleton_knight'`, `toCardId: 'undead_commander'` → post-evolution
  inventory shows `undead_commander` with `isEvolved: true`, `grind: 0`,
  `evolvedFrom: 'skeleton_knight'`.
- A committed evidence file
  `game/docs/walkthroughs/card-evolution/card-evolution-snapshot.json` exists in
  the diff, produced by the green run. Its contents prove the evolution path
  fired: `lastEvolutionResult.fromCardId === 'skeleton_knight'`,
  `lastEvolutionResult.toCardId === 'undead_commander'`, and the inventory
  contains the evolved instance with correct fields.
- The `card-evolution.png` screenshot is still written by the script for local
  evidence, but it is NOT expected in the committed diff because
  `game/docs/walkthroughs/**/*.png` is gitignored repo-wide — do NOT force-add
  it or alter `.gitignore` to commit it.
- Any change needed to make the run reliably succeed is confined to the smoke
  script and/or the 01 hooks' `evolution-ready` setup (e.g. ensuring the
  `skeleton_knight` instance is correctly in the deck, grind is exactly `+10`,
  or the `__evolveCardForTest` helper correctly resolves). Do NOT add special-case
  evolution logic that bypasses the real `evolveCard` path.
- The script still launches its OWN isolated high-port server + vite
  (`PORT=32xx`, vite `--port 52xx --strictPort`, `ALLOW_DEBUG_SCENARIOS=1`,
  `PERSISTENCE_BACKEND=memory`) and tears down every process it spawns on success
  and failure — no orphaned `node`/`vite` processes remain after the run.
- Existing server + client behaviour is unaffected (the smoke script touches only
  the debug-scenario QA path); the game still starts and loads cleanly via the
  script's own launch.

## Technical Specs

- Run target: `game/client/scripts/test-card-evolution.mjs` (already present
  from sub-ticket 02). Depends on sub-ticket 01's `evolution-ready` debug
  scenario, the `inventory` / `lastEvolutionResult` fields on
  `window.__AUTOGAME_HARNESS_STATE__`, and `window.__evolveCardForTest()`.
- If the evolution trigger is the failure point, fix it in
  `test-card-evolution.mjs` (instance ID extraction, deck editor visibility,
  timing) and/or tighten the `evolution-ready` setup in
  `game/server/debugScenarios.js` so the `skeleton_knight` at `+10` grind is
  reliably present and evolvable. Keep evolution flowing through the existing
  real `evolveCard` path in `game/server/progression.js`.
- Output dir: `game/docs/walkthroughs/card-evolution/` (the script already
  creates it with `fs.mkdirSync(..., { recursive: true })`). Commit only the
  `card-evolution-snapshot.json` artifact; leave the `.png` uncommitted
  (gitignored).
- Use the project's own teardown that the script already implements; do not
  introduce new long-lived processes.

## Verification: code
