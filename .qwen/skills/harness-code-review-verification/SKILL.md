---
name: harness-code-review-verification
description: Verify a harness sub-ticket by checking acceptance criteria against live code, runtime logs, and distinguishing pre-existing test flakiness from new regressions
source: auto-skill
extracted-at: '2026-05-31T05:54:57Z'
---

# Harness Code Review Verification

Procedure for reviewing a sub-ticket in the autogame autonomous development harness.

## Step 1 — Gather Evidence

Read all inputs in one pass:
- The sub-ticket file (`ticket.md`) — acceptance criteria and technical specs
- The named source file(s) from the ticket's Technical Specs section
- Runtime artifacts: `server.log`, `console.log`, `metrics.json`, `local-checks.status.json`, `local-checks.log`
- Run `git diff HEAD -- . ':!tickets'` to see what changed this iteration

## Step 2 — Verify Each Acceptance Criterion Against Live Code

For **each** acceptance criterion:
- Locate the relevant code in the current source file (not just the diff)
- Confirm the criterion holds in the **end state**, whether implemented this iteration or already present
- State **PASS** or **FAIL** with specific code evidence (function name, line pattern, formula match)

A criterion already satisfied by pre-existing code still counts as met. A stale ticket with an empty/minimal diff is a **PASS** if all criteria hold.

### QA Evidence Tickets (smoke-run sub-tickets)

For tickets whose sole deliverable is running a smoke script and committing an evidence snapshot:
- An empty `git diff HEAD` is the **correct** outcome — all artifacts were committed by the implementer
- Verify the committed snapshot file (e.g., `*-snapshot.json`) exists at the expected path and contains the proof fields named by the acceptance criteria (e.g., `lastEvolutionResult.fromCardId`, `postEvolution.isEvolved`)
- Confirm the smoke script flows through the **real production path** (e.g., `evolveCard` in `progression.js`, not a test-only bypass)
- Confirm screenshots (`.png`) are gitignored per repo convention (`game/docs/walkthroughs/**/*.png`) and NOT force-added

## Step 3 — Check Runtime Health

- `local-checks.status.json`: should show `rc: 0`. A nonzero `rc` is suspicious but **not automatically fatal** — it can indicate a harness infrastructure timeout (e.g., server startup detection race) rather than a code error. Cross-check:
  - If `server.log` shows clean startup (`Server listening on port ...`) and no game-code errors, and all server tests pass, the `rc: 1` is likely a harness timing issue, not a blocker.
  - If `metrics.json` shows `"ok": false, "error": "servers did not start"` but `server.log` proves the server did start, treat it as a harness detection false positive.
- `console.log`: should be empty or contain only benign noise (THREE.js deprecations, headless WebGL messages, Vite ws proxy / EPIPE)
- `server.log`: should show clean startup, no errors from game code
- `metrics.json`: `ok: true` and servers started
- Ignore benign environment/library noise — only genuine errors from the game's own code count

## Step 4 — Distinguish Pre-Existing Flaky Tests from New Regressions

When `local-checks.status.json` shows `rc: 1` or a test failure appears:

1. Identify the failing test name and file from `local-checks.log`
2. Check if the failing test is related to files changed by this ticket
3. If unrelated, confirm it's pre-existing:
   - Run `git stash`
   - Run the failing test file: `pnpm --dir game test -- <test-file>`
   - Check if it also fails on the clean tree (or passes, confirming flakiness)
   - Run `git stash pop` to restore changes
4. If the test passes on the clean tree but fails with changes → investigate as a regression
5. If the test is flaky (passes sometimes, fails others) regardless of changes → document as pre-existing flakiness, do not block the ticket

## Step 5 — Verify Technical Spec Compliance

Cross-check the implementation against the ticket's Technical Specs:
- Formula accuracy (e.g., edge-average deltas, rotation angles)
- Correct fallback paths (legacy/absent fields)
- No new allocations where existing shared resources should be reused
- Out-of-scope items are truly untouched

## Step 6 — Check New Tests

Run the affected test file and confirm all new tests pass:
```bash
pnpm --dir game test -- <test-file> --reporter=verbose 2>&1 | grep -E 'Test Files|FAIL'
```

## Output Format

For each criterion:
- **Criterion text**
- **PASS** or **FAIL**
- Specific code evidence (function, line pattern, value)

Final line: `VERDICT: PASS` or `VERDICT: FAIL`
