# Senior Review — 164-cleanup-retire-legacy-bash-harness

## Runtime health (gate)

- `metrics.json`: `"ok": true`, `pageerrors: []`, no `harness_failure` block.
- Capture ran the full smoke flow (auth → lobby create/join → ready → movement →
  dodge with cooldown probe). All four screenshots produced; `phase: "playing"`,
  `connectionState: "connected"`, `sceneInitialized: true`, two clients connected.
- Dodge cooldown HUD behaved correctly: post-dodge probe shows
  `keyItemCooldownRemaining: 675`, `keyItemIndicatorOnCooldown: true`,
  `keyItemIndicatorText: "0.7"`, then returns to 0 / inactive.
- `console.log` contains no `pageerror` or `[fatal]` lines. The only `[error]`
  lines are `409 (Conflict)` on a resource load — a benign known-harness
  artifact, not game code, and gameplay proceeded normally afterward.

The game starts and loads cleanly. Gate passes.

## Scope of the change

`git diff 515f4c9..HEAD` is a pure harness cleanup — **zero `game/` files touched**:

- Deleted dead bash: `lib.sh` (1365), `run_ticket.sh` (516), `run_subtask.sh`
  (371), `run_backlog.sh` (50), `supervisor.sh` (66), plus the smoke/test
  helpers `qwen_vision_smoke.sh`, `test_port_ownership.sh`,
  `test_review_recovery.sh`. ~2659 lines removed.
- `harness/cli.py`: one-line fix to a stale message that pointed users at the
  now-deleted `qwen_vision_smoke.sh` ("vision smoke not yet ported to the
  Python harness"). Correct cleanup of a dangling reference.

## Acceptance criteria

**AC1 — "Implements the Goal above; the change is scoped to it."** — MET.
- The five bash files named in the Goal are removed, plus their sibling
  bash test/smoke helpers (consistent with "retire the legacy bash harness").
- No executable dependency on the deleted scripts remains. Grep for
  invocations (`bash/sh/source/./ … *.sh`) finds nothing; the only residual
  mentions are (a) docstring citations like `lib.sh:316-334` that document
  what each Python module was ported *from*, and (b) the historical
  `harness/docs/python-rewrite.v1.md` design doc. None of these import or
  execute the deleted files.
- Recoverability preserved exactly as the Goal requires: tag
  `bash-rollback-v1` exists and still contains `lib.sh`, `run_ticket.sh`,
  `run_subtask.sh`, `run_backlog.sh`, `supervisor.sh`.
- `harness/lint.sh` (not a target) is correctly left untouched.

**AC2 — "Existing server + client tests pass; the game starts and loads
cleanly."** — MET.
- Game starts/loads cleanly — see runtime gate above.
- Server + client test suites live entirely under `game/`, which this diff does
  not touch, so they are unaffected by definition. `coverage.log` confirms "No
  test files found" for changed files (the changed files are harness Python/bash,
  outside vitest's `game/` scope) — expected for a harness-only cleanup.

## Remaining gaps

None. The change is correct, minimal, and scoped exactly to the Goal; the
captured run proves the game is healthy and the deletions are recoverable from
`bash-rollback-v1`.

VERDICT: PASS
