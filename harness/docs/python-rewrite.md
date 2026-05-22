# Python rewrite of the autogame harness

**Status:** design draft v5, pre-implementation. Owner: Matt + Claude.
**Cutover model:** **phased PRs on a `python-rewrite-cutover` branch, with a
single revert-able commit as the final tmux-launch swap.** Not big-bang in
the sense of "one PR replaces all bash" — the cutover branch lands in 5–6
sized PRs (skeleton, agents, roles, pipelines, equivalence harness,
cutover) so each is reviewable. The branch only merges to `main` after the
recorded-fixture equivalence test passes; merging is a single commit so
revert is one `git revert`.
**Scope:** harness only. The `game/` codebase is unchanged.

## Changelog vs v4

v5 after a fourth review round. claude said READY (1 nit on
`result._replace` not working on @dataclass; 1 nit on stale §7.4
prose; 1 nit on a self-contradictory revert comment). gpt said
NOT READY with one genuine substantive blocker plus the same stale
§7.4 prose:

- **§7.4 untracked-file detection — pre-call baseline.** v4 detected
  untracked files via `git status --porcelain --untracked-files=all`
  AFTER the agent ran. That's destructive: any stale untracked file
  that existed BEFORE the call (e.g. operator-left scratch file, an
  earlier crashed run's artifact) shows up as `??` after the run too,
  and v4's `scope_audit` would treat it as "agent created" and
  `rm -f` it. v5 takes a pre-call `untracked_before: set[Path]`
  snapshot and only considers files that appeared in
  `(post_call - untracked_before)`. Same change applied to the §11.3
  fixture recorder.
- **§6.2 Role.execute** — snapshots both `head_before` and
  `untracked_before` before `agent.run()`; passes both to
  `scope_audit`.
- **§5.1 AgentResult mutation** — `result._replace(...)` was wrong
  (only NamedTuples have `_replace`). Use
  `dataclasses.replace(result, reason=…)`.
- **§7.4 — "PIPELINE caller decides" prose rewritten** to match v4's
  decision to put scope-audit ownership inside `Role.execute`. The
  per-pipeline policy table is gone; the per-role consequences are now
  expressed as "what falling-through means for each role" since the
  policy IS the fallback-chain semantics.
- **§6.2 self-contradictory comment fixed** — v4 had
  `audit.revert_out_of_scope_paths(workspace) # already done by scope_audit`
  which both calls the method AND says it's already happened.
  Comment kept, call dropped (scope_audit reverts in-line as part of
  its detection-and-act loop).

## Changelog vs v3

v4 after a third review round. claude said YES, ready to implement.
gpt said NO with 2 blockers. Both blockers genuinely surgical; v4
addresses them so the disagreement collapses:

- **§7.4 `scope_audit` detection** — `git diff --name-status` doesn't
  see untracked files. Combined with `git status --porcelain
  --untracked-files=all` so newly-created out-of-scope files are
  detected (e.g. an agent that creates `harness/sneaky.txt` was
  invisible to v3's audit). Adds the rule: tracked changes come from
  `git diff HEAD_before`, untracked from `git status` `??` entries.
- **§6.2 Role.execute** — `scope_audit` ownership moved INSIDE the
  per-tier loop. v3 had `subtask()` and `ticket()` calling
  `scope_audit()` externally for some roles (and forgetting others —
  implementer, rescue, split, repair were not audited despite §7.4's
  promise). v4 makes the audit a Role responsibility: for any writable
  role, Role.execute snapshots `head_before` immediately before
  `agent.run()`, runs `scope_audit()` immediately after, and downgrades
  the tier result to FailureReason.SCOPE_VIOLATION if violations are
  found — which then drives the per-tier fallback chain naturally
  (matches §7.4's promise). External callers no longer need to know
  about scope; one safety boundary.
- **§8.2** — external `scope_audit()` call removed (now inside
  Role.execute). Added a helper definition for
  `scope_conflict_sentinel_in()` (claude nit). Added the comment about
  protect_review's chmod read-order (claude nit).
- **§11.3 recording** — fixture recorder captures untracked files too
  (same rationale as §7.4): a sub-ticket / review / split file written
  by the agent is untracked at record time; the replay must reproduce
  it. The recorder reads `git status --porcelain
  --untracked-files=all` after each agent call and snapshots `??`
  entries the same way as modified files.
- **Status line** updated v2 → v3 → v4 (gpt R3 nit).
- **Phase 5 step 25** — clarified "fix means": small Python patch lands
  on the cutover branch; if a behavior gap is severe (recovery path
  miscompares vs bash), revert the tmux-launch commit and restart
  observation window. (claude nit).

## Changelog vs v2

This is v3 after a second round of review by the same two reviewers.
Round-2 was sharper: claude said "ready with three small edits"; gpt
said "not ready, nine blockers." Most of gpt's "blockers" were real
bugs in the v2 code skeletons (not the design itself) — both reviewers
agreed on the SIGHUP closure bug, the ticket() FAILED_SUBS branch, and
scope_audit being undefined. v3 fixes all 12 substantive items:

- **§5.1** — `AgentResult.exit_code: int` added; `FailureReason.EXIT_NONZERO`
  is still the bucket but the exact rc is preserved (ports bash's
  `exit_$rc` granularity for telemetry).
- **§5.3** — `spawn()` retries are configurable per Agent; `AgyAgent`
  defaults to 0 spawn retries (gpt R2 — bash intentionally gives agy no
  retries).
- **§6.1** — new `ReviewAccept` acceptance kind: accepts when `review.md`
  exists AND contains a verdict line; `gaps.md` and `nits.md` are
  optional (they're only written on FAIL or when nits exist). Also: the
  acceptance check internally runs `recover_review_files` on the agent
  stdout BEFORE deciding the tier failed — so a chat-mode reviewer that
  printed file contents instead of writing them isn't wrongly skipped.
- **§6.3** — review role gets `fallbacks_by_difficulty:` as an optional
  per-difficulty fallback chain override (claude R2 #10 — `composer_write`
  is a bad fallback for an `extra-high` primary). Timeout key naming
  standardized to `_s` suffix everywhere.
- **§6.6** — recursive merge spec for nested tunables (`tunables.pipeline.*`
  fields merge field-by-field; lists replace whole).
- **New §7.4** — `scope_audit()` algorithm fully specified: detection
  (git diff in workspace vs role.scope), revert action (git checkout
  HEAD -- … for modified files; `rm -f` for newly created files outside
  scope), result downgrade to `TOOL_FAILURE` with reason
  `SCOPE_VIOLATION`. Plus the cases the algorithm explicitly handles
  (file created inside vs outside scope, file modified inside vs outside,
  rename across scopes).
- **§8.1** — `ticket_allows_harness` detection rule: grep ticket file
  for `(^|[^[:alnum:]_./-])harness/` (ports bash `run_subtask.sh:35-38`).
- **§8.2** — `ticket()` control flow rewritten to fix the four bugs both
  reviewers flagged: (a) check `decompose()` rc — only fall back to
  single-sub when decompose succeeded and produced nothing, retry next
  round when decompose itself failed; (b) accumulate `failed_subs` and
  continue to the next round without running review/coverage/capture_run
  when any sub-ticket returned rc=1; (c) SCOPE-CONFLICT (rc=3) uses an
  outer-loop flag and `continue`s the round loop, not just breaks the
  sub-ticket loop; (d) `finalize()` failure inside (e.g. commit_verified
  failed) escalates rc=2 to the supervisor. Plus: `coverage.log` is
  copied into the review artifacts dir (gpt R2 — the review.md prompt
  expects it there); a one-line comment on the post-rescue review failure
  falling through to split (claude R2 #5).
- **§8.4** — `Supervisor.run()` SIGHUP handler fixed: instance attribute
  `self.roster` reassigned by handler, read by loop on each iteration.
  No walrus-in-lambda.
- **§9.3** — `start_if_needed()` is called by every Python subcommand
  that might emit events (`supervisor`, `backlog`, `ticket`, `subtask`),
  not just `supervisor`. Server is started once and reused; subsequent
  calls are no-ops.
- **§11.3** — equivalence test spec extended: the recording captures
  filesystem state diffs after each agent call (not just stdout), and
  the `MockAgent` replays both the stdout AND the filesystem changes.
  The matching key is `(sub_ticket_label, iteration, role_name,
  call_order_within_iteration)`. Recording is done on a recent `main`
  HEAD (not the rollback tag) to avoid the patched-bash-on-frozen-tag
  drift risk. "Identical commit SHAs" softened to "identical staged
  diffs" (SHAs depend on commit timestamps).
- **§12** — explicit count "5 PRs on the cutover branch + final
  delete-bash PR" (was "Five sized PRs" then PR #6 appearing later).
  Phase 2 explicitly notes integration tests land in phase 3+ (claude
  R2 #11).
- **§13** — Q11 (SCOPE-CONFLICT) reworked to reference the §8.2 outer-loop
  flag mechanism; new Q16–Q18 added for the per-difficulty fallback
  ergonomics, the equivalence-recording lifecycle, and the
  non-supervisor subcommand progress-server policy.
- **§15** — last bullet tightened.

Also incorporated: tmux launch command quoting (so the supervisor's
output, not tmux's, lands in LOOPLOG.txt); the `Linux-only` SIGHUP note;
`timeout_s` consistent naming; `--retired--` row in §10 demoted to a
footnote.

## Changelog vs v1

This is v2 after a round of review by gpt-5.5-extra-high-fast and a
claude general-purpose subagent. The substantive changes from v1:

- **§3** — explicit note that there are three retry layers (subprocess /
  role-fallback / iteration); they must not be collapsed.
- **§4** — drop the async/anyio framework for day 1; subprocess + threads
  is enough until phase 6 (parallel workers). Add modules for the bash
  behaviors v1 missed: `steps/{rescue,split,finalize,protect_review,
  coverage,ingest_nits,confirm_game_broken,filter_feedback}.py`.
- **§5** — drop `Capability` flag (no dispatch on it) and `cost_tier` (no
  consumer). Per-backend knobs (qwen openai-logging, agy print-timeout,
  vision settings, claude model) become typed fields on each Agent
  subclass's config dataclass — not an `extra: dict` escape hatch.
  Introduce `FailureReason` enum (ports the bash `cli_failure_reason`
  vocabulary). Drop `AgentResult.diff`; ScopeAudit owns the snapshot.
  Add explicit `usage_kind` field (ports `HARNESS_USAGE_KIND`).
- **§6** — generalize `VerdictParser` to `AcceptanceCriterion` with kinds
  `{verdict, files_written, ok_rc}`. Replace YAML anchors with a named
  `agents:` mapping. Add `_role_defaults:` for per-family base. Add
  `tunables:` top-level section for non-role config (`MAX_ITER`,
  `*_TIMEOUT`, `GAME_URL`, `PIPELINE_*`, `QWEN_VISION_FEEDBACK`).
  `roles.local.yaml` does **field-level** merge, not full replacement.
  Hot-reload boundary: top-level supervisor invocation only (one boundary,
  not per-pipeline). Add `schema_version: 1`. Collapse the three
  `review:{easy,medium,hard}` roles into one `review` role with a
  `primary_by_difficulty:` map.
- **§7** — drop the `Workspace` ABC for day 1. One concrete `Repo` class
  with named git helper functions. Path-scope moves out of the workspace
  API (it's a Role concern); commit() takes a simple path-glob list.
  When phase 6 adds `WorktreeWorkspace`, the ABC gets extracted from the
  real seams then.
- **§8** — rewrite pipelines as plain Python functions, not combinators.
  Add the bash behaviors v1 missed to `TicketPipeline`:
  `capture_run` (pre-review screenshots), `coverage` (vitest --coverage
  --changed), `protect_review` (chmod + archive), `verify_reviews`
  (integrity check + restore), `finalize` (game_smoke_ok →
  `confirm_game_broken` → tag → LOGBOOK append → TASKS.md flip →
  `ingest_nits`), claude **rescue** pass (last resort after
  `TICKET_MAX_ROUNDS`), claude **split** pass (carve unsolvable ticket).
  Add `revert_game_changes` on sub-ticket failure exhaustion. Add
  `filter_agent_feedback_noise` before feedback append. `BacklogPipeline`
  handles the 4-way rc switch (0/1/2/3) per `run_backlog.sh:30-47`,
  including rc=3 (ticket split → re-scan backlog) and the planned
  sub-ticket rc=3 (SCOPE-CONFLICT sentinel → route to next-round
  decomposer, per the user's [[scope-conflict-sentinel]] memory).
- **§9** — `log.txt` captures *all* pipeline stdout/stderr (matches bash
  `exec > >(tee)`), not just agent stdout. Add `agent_bucket_for_label`
  (local/remote) which partitions the GPU-uptime UI. Document
  `progress/server.mjs` lifecycle: `python -m harness progress {start,
  stop, status}`; supervisor starts it at boot.
- §10 — add 14 missing rows. Drop `lint.sh` row (dead after cutover).
  Note Gemini quota fast-fail as retired.
- §11 — add 7 missing integration tests; smoke tests assert contract
  (has_verdict / produces-diff), not just non-empty.
- §12 — phased PR plan made explicit. Equivalence test is recorded-trace
  replay with mocked agents, not a single live run. Split "switch tmux
  launch to python" from "delete `harness/*.sh`" with a one-week
  observation window between.
- §13 — most v1 open questions answered above; new open questions added.
- §14 — risks updated.

## 1. Goals

1. **Role-as-data.** Today's `IMPL_MODEL` / `QA_MODEL` / `DECOMP_MODEL`
   env-var zoo collapses to a single `roles.yaml` where each role names a
   primary backend, a fallback chain, a timeout, an acceptance criterion,
   and a writable flag. Switching the implementer from qwen to composer is
   a one-line YAML edit, hot-reloaded at the next supervisor invocation —
   the same UX as today's `runtime.env`, but for the full chain instead of
   three keys.
2. **Agent-as-class.** Each backend CLI gets one Python class implementing
   a shared `Agent` interface plus its own typed config dataclass.
   Per-backend quirks (cursor-agent's `--mode ask` trap, qwen's
   blank-output failure mode, agy's missing `--model` flag) are
   encapsulated and don't leak into the dispatch logic.
3. **Pipeline-as-function.** `run_subtask.sh` becomes a `subtask()`
   function in `pipelines/subtask.py` with explicit control flow. Pipelines
   are code, not data; they get the same review/refactor/breakpoint
   affordances as any other Python code. (v1 proposed combinators; both
   reviewers correctly flagged that as overbuilt — see §3.3.)
4. **Worktree-per-worker (foundation).** The single concrete `Repo` class
   in day 1 is the seam where `WorktreeWorkspace` will be extracted in
   phase 6. The interface isn't pre-declared; it falls out of the diff
   when the second concrete class arrives.
5. **Repair-agent path preserved.** `supervisor.sh`'s "on tool-failure,
   call claude to repair" loop is a feature, not an accident. The Python
   supervisor keeps it, modeled as a `repair_pass()` function called on
   the `tool_failure` branch.
6. **Bash behavior parity, full.** Every bash behavior currently exercised
   on the loop ships in v1 of the Python harness — including the
   recovery-and-finalization machinery v1 of this doc missed: rescue,
   split, protect_review/verify_reviews, capture_run, coverage,
   ingest_nits, confirm_game_broken, revert_game_changes,
   filter_agent_feedback_noise. The §10 mapping table is the parity
   contract.

## 2. Non-goals

- **Not** switching to model SDKs. Per §3.2, every Agent shells out to its
  existing CLI; the Python layer is structured argv + structured parsing.
  SDKs can come later, file-by-file, without changing the interface.
- **Not** rewriting the prompt templates. The 11 markdown files under
  `harness/prompts/` are reused verbatim; only the renderer (today's
  `render_prompt` bash function) is reimplemented.
- **Not** changing the ticket/sub-ticket directory layout, the `.passed`
  marker convention, the `feedback.md` / `handoff.md` / `review.md` /
  `gaps.md` / `nits.md` file contract, or the `v0.X` git tag convention.
  All of these are how tickets and sub-tickets persist progress; touching
  them would force every in-flight ticket to be replayed.
- **Not** rewriting the progress UI under `harness/progress/public/`. The
  server emits the same `events.ndjson` stream; the browser bundle is
  unchanged. The server's lifecycle moves into the Python supervisor
  (see §9.3).
- **Not** parallel workers from day 1. The single-worker port is phase 5;
  the parallel-workers work (worktrees + merge queue + concurrent
  scheduler) is phase 6 and a separate PR.
- **Not** async-everywhere from day 1. v1 reached for `anyio` /
  `asyncio.create_subprocess_exec` because parallel workers will need it
  eventually; both reviewers correctly noted that day 1 has no
  concurrency (subprocess-per-sub-ticket isolation) and async pays no
  rent. Day 1 uses `subprocess.run` + `threading` for the parallel
  pipeline-checks pattern; phase 6 introduces async where it pays.

## 3. Architecture

### 3.1 The four layers

```
┌─────────────────────────────────────────────────────────────────────┐
│ Orchestrator                                                        │
│  Supervisor → Backlog → Ticket → SubTicket                          │
│  (the loops; what supervisor.sh / run_backlog.sh / run_ticket.sh do)│
└──────────────────────────────┬──────────────────────────────────────┘
                               │ calls pipeline functions
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Pipeline (plain Python functions)                                   │
│  subtask(), ticket(), backlog(); rescue(), split(), finalize();     │
│  capture_run(), coverage(), protect_review(), ingest_nits(), …      │
│  (what run_subtask.sh / run_ticket.sh do, as readable Python)       │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ dispatches role.execute()
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Role                                                                │
│  Primary Agent + fallback chain; AcceptanceCriterion;               │
│  per-tier classify-and-retry policy                                 │
│  (what the qa-chain ladder + QA_MODEL prepend logic do)             │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ calls
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Agent                                                               │
│  One concrete CLI backend: QwenAgent, CursorAgent, AgyAgent,        │
│  ClaudeAgent, QwenVisionAgent. Each owns argv construction,         │
│  subprocess management, timeout, stdout capture, FailureReason      │
│  classification, telemetry emission, retries (per-call only).       │
└─────────────────────────────────────────────────────────────────────┘
```

Each layer talks only to the one directly below.

**Three retry layers, deliberately distinct (call this out so future
maintainers don't collapse them):**

| Layer       | What it retries                                                                                              | Cap        |
| ----------- | ------------------------------------------------------------------------------------------------------------ | ---------- |
| Agent       | One CLI call: empty stdout, "you have exhausted your capacity" sentinel, hard timeout, api-error-only output | 2 retries  |
| Role        | Tier promotion: primary → fallback[0] → fallback[1] → …                                                      | chain len  |
| Iteration   | Whole sub-ticket pass: implementer → tests → QA → (FAIL → next iteration)                                    | `MAX_ITER` |

Each layer addresses a different class of failure. Collapsing two of them
would either over-retry (cost) or under-retry (escalate too eagerly).

### 3.2 Why subprocess wrappers, not SDKs

The cursor `agent` CLI is the only way to get composer-2.5* and
gpt-5.5-* without rebuilding cursor-agent's tool-use scaffolding from
scratch. The qwen CLI similarly bundles MCP-server config (used for
`qwen-vision` via the playwright MCP). Antigravity has no SDK. Anthropic
and OpenAI both have SDKs but they're the minority of calls.

Shelling out preserves all of the above and means the Python rewrite is a
strict refactor of orchestration — not a rewrite of how any individual
call behaves. That bounds the test surface: if today's prompt-X-via-CLI-Y
produces output Z, tomorrow's prompt-X-via-PythonAgent-Y produces the same
output Z, because PythonAgent shells out to the same CLI with the same
argv.

Migrating individual Agents to SDKs later is a per-class change, no
interface impact.

### 3.3 Why YAML for roster, code for pipelines

Roles change frequently and are typed by humans during experiments
(today's runtime.env). YAML is the right shape: declarative,
hot-reloadable, easy to diff, easy to point a non-Python operator at.

Pipelines change rarely and have non-trivial control flow (parallel
pipeline checks during screenshot capture, branch on PASS/FAIL, optional
vision feedback, rescue/split fallbacks at the ticket level). Python code
is the right shape: gives us types, refactoring, breakpoints, and
ordinary stack traces.

v1 proposed a combinator framework (`SequenceStep`/`ParallelStep`/
`BranchStep`/`IterateStep`/…) for the pipelines. Both reviewers flagged
this as reimplementing a workflow engine for no benefit. The combinator
framework is appropriate when pipelines themselves are loaded from data
(graph editors, user-defined workflows); we don't have that. v2 writes
pipelines as plain functions — a `for` loop is `for`, a branch is `if`.

### 3.4 Pipeline ↔ Role coupling

The Pipeline knows which role names exist — `subtask()` calls
`roster.role("implementer")`, `roster.role(f"qa:{ticket.qa_mode}")`,
`roster.role("committer")`, etc. The role names are a coordination
contract between code and config; that's intentional. The Roster
validates that every role name referenced by the pipelines exists in
the YAML at supervisor startup. Missing-role errors fail at boot, not
at the first sub-ticket.

## 4. Module layout

```
harness/
  pyproject.toml              # py3.12; stdlib subprocess + threading
  roles.yaml                  # roster + tunables (committed)
  roles.local.yaml            # optional, gitignored — runtime overrides
  __main__.py                 # `python -m harness <subcommand>`
  cli.py                      # subcommand router (supervisor, backlog, ticket, subtask, progress, doctor)
  config/
    __init__.py
    schema.py                 # Pydantic models for roles.yaml (the source of truth)
    loader.py                 # roles.yaml + roles.local.yaml merge (field-level), schema_version handling
    tunables.py               # non-role tunables (MAX_ITER, *_TIMEOUT, GAME_URL, PIPELINE_*, QWEN_VISION_FEEDBACK)
  agents/
    __init__.py
    base.py                   # Agent ABC, AgentResult, FailureReason, AgentInvocation
    spawn.py                  # the shared subprocess + classify + retry wrapper
    qwen.py                   # QwenAgent + QwenVisionAgent
    cursor.py                 # CursorAgent (composer-2.5*, gpt-5.5-*; writable / read-only)
    agy.py                    # AgyAgent (Antigravity / Gemini, no --model flag)
    claude.py                 # ClaudeAgent
  roles.py                    # Role, Roster, ChainResult, AcceptanceCriterion
  workspace/
    __init__.py
    repo.py                   # the single concrete workspace (day 1)
    ports.py                  # PortAllocator (game-server + vite; fixed pair day 1)
    # phase 6 adds worktree.py + merge_queue.py here
  pipelines/
    __init__.py
    subtask.py                # subtask() — replaces run_subtask.sh
    ticket.py                 # ticket() — replaces run_ticket.sh main loop
    backlog.py                # backlog() — replaces run_backlog.sh
  steps/
    __init__.py
    # sub-ticket steps
    implement.py              # implement() — invokes implementer role
    qa.py                     # qa() — invokes qa:code or qa:visual role
    pipeline_checks.py        # background_vitest() — server+client; writes local-checks.status.json
    game.py                   # start_game(), stop_game(), wait_for_game(); ports per workspace
    screenshot.py             # capture() — invokes screenshot.mjs subprocess
    commit.py                 # commit_with_role() — role-driven; deterministic fallback
    handoff.py                # ensure_handoff() — synthesize when implementer left none (content-hash, not mtime)
    feedback.py               # accumulate_feedback() — applies filter_agent_feedback_noise before appending
    vision_feedback.py        # optional_vision_feedback() — only on visual QA fail
    revert_game.py            # revert_game_changes() — on sub-ticket MAX_ITER exhaustion
    # ticket steps
    decompose.py              # decompose() — invokes decomposer role
    capture_run.py            # capture_run() — pre-review screenshot pass
    coverage.py               # coverage_run() — vitest --coverage --changed BASE_REF
    review.py                 # review() — invokes review role; awk recovery fallback
    protect_review.py         # protect_review() + verify_reviews()
    append_review.py          # append_review_pointer() + put_review_fb()
    rescue.py                 # rescue() — claude implements after rounds exhausted
    split.py                  # split() — claude carves unsolved ticket; ===NEXT TICKET=== parser
    finalize.py               # finalize() — game_smoke_ok → confirm_game_broken → tag → LOGBOOK → TASKS.md → ingest_nits
    confirm_broken.py         # confirm_game_broken() — second capture run to disambiguate flake
    ingest_nits.py            # ingest_nits() — file follow-up ticket + TASKS.md surgery
    # supervisor step
    repair.py                 # repair_pass() — supervisor's escalate-to-claude
  prompts/
    renderer.py               # render_prompt equivalent
    acceptance.py             # AcceptanceCriterion implementations: VerdictAccept, ReviewAccept, OkRcAccept
    noise_filter.py           # filter_agent_feedback_noise()
  git_helpers.py              # commit_verified() + scope helpers + next_version_tag() + chmod helpers
  telemetry/
    progress.py               # emit_progress_event → events.ndjson + HTTP POST
    usage.py                  # record_agent_usage (tokens, model, duration, usage_kind, bucket)
    logging.py                # logger that tees ALL stdout/stderr to per-pipeline log.txt
    progress_server.py        # lifecycle wrapper for progress/server.mjs (start/stop/status)
  supervisor.py               # outermost watchdog (replaces supervisor.sh)
  tests/
    unit/
    integration/
    smoke/                    # gated by env vars; real CLIs
    fixtures/
      bash_runs/              # recorded prompt+response traces for equivalence tests
  # unchanged: prompts/, progress/server.mjs, progress/public/, githooks/
```

`__main__.py` makes `python -m harness …` the single entry point:

| Today                       | Tomorrow                                    |
| --------------------------- | ------------------------------------------- |
| `bash supervisor.sh`        | `python -m harness supervisor`              |
| `bash run_backlog.sh`       | `python -m harness backlog`                 |
| `bash run_ticket.sh <name>` | `python -m harness ticket <name>`           |
| `bash run_subtask.sh <dir>` | `python -m harness subtask <dir>`           |
| `bash qwen_vision_smoke.sh` | `python -m harness doctor vision`           |
| `bash lint.sh`              | (no replacement — shellcheck targets no bash post-cutover; lint.sh is deleted at cutover) |
| (was: tmux pane runs `pnpm run progress`) | `python -m harness progress {start,stop,status}` (started by `supervisor`) |

The tmux launch command becomes:

```bash
# Inner `bash -c` keeps stdout-redirection inside the session, so
# LOOPLOG.txt receives the supervisor's output — not tmux's. Matches the
# bash version, which had the same wrapping.
tmux new-session -d -s autogame "bash -c 'python -m harness supervisor 2>&1 | tee -a LOOPLOG.txt'"
```

## 5. The Agent interface

### 5.1 Base types

```python
# harness/agents/base.py
from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Mapping


class UsageKind(str, Enum):
    """Bucketing for telemetry; ports the bash HARNESS_USAGE_KIND env var."""
    IMPLEMENTER  = "implementer"
    QA           = "qa"
    DECOMPOSER   = "decomposer"
    COMMITTER    = "committer"
    FINAL_REVIEW = "final_review"   # writable top-level reviewer
    REPAIR       = "repair"
    RESCUE       = "rescue"
    SPLIT        = "split"
    VISION       = "vision"


class FailureReason(str, Enum):
    """
    Ported verbatim from bash `cli_failure_reason` (lib.sh:297-314).
    The vocabulary is consumed by both the Role fallback decision and the
    telemetry consumer; an Enum keeps them in lockstep.
    """
    OK                    = "ok"
    EMPTY_OUTPUT          = "empty_output"
    API_ERROR_ONLY_OUTPUT = "api_error_only_output"
    QUOTA_OR_RATE_LIMIT   = "quota_or_rate_limit"
    TIMEOUT               = "timeout"
    KILLED_AFTER_TIMEOUT  = "killed_after_timeout"
    TERMINATED_BY_SIGNAL  = "terminated_by_signal"
    EXIT_NONZERO          = "exit_nonzero"     # generic non-zero exit; exact rc in AgentResult.exit_code
    SCOPE_VIOLATION       = "scope_violation"  # downgrade applied by scope_audit() — see §7.4


@dataclass
class Prompt:
    """A rendered prompt string + the source template path (for telemetry)."""
    body: str
    template: Path


@dataclass
class AgentInvocation:
    """
    Everything the wrapper needs to make one call. The Role builds this
    from its YAML config plus per-call inputs; the Agent doesn't see the
    Role itself.
    """
    prompt: Prompt
    timeout_s: float
    out_file: Path
    usage_kind: UsageKind
    # Optional extra: per-call paths the renderer already absolutized
    # (e.g. agy's @file resolution requires absolute paths — see AgyAgent).


@dataclass
class AgentResult:
    rc: int                            # 0 = ok, 1 = task-failure, 2 = tool-failure (matches bash convention)
    reason: FailureReason              # bucketed classification (see §5.1 enum)
    exit_code: int                     # exact CLI exit code; preserves bash's `exit_$rc` granularity
                                       # for telemetry, while FailureReason buckets it for dispatch
    stdout: str
    duration_s: float
    started_at: float                  # unix epoch
    ended_at: float
    # Tokens / usage if the backend reports them; otherwise zero.
    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: float = 0.0
    # Backend session id, qwen model, cursor model, etc. — narrow, not a
    # generic escape hatch.
    backend_meta: Mapping[str, str] = field(default_factory=dict)

    @property
    def ok(self) -> bool:
        return self.rc == 0 and self.reason is FailureReason.OK


class Agent(ABC):
    """One concrete CLI backend wrapper. Subclasses own a typed config."""

    name: str           # e.g. "cursor/composer-2.5-fast (writable)"
    writable: bool      # may modify files in the workspace (Workspace contract)
    bucket: str         # "local" | "remote" — partitions GPU-uptime telemetry

    @abstractmethod
    def run(
        self,
        invocation: AgentInvocation,
        workspace: "Repo",
        *,
        telemetry: "TelemetrySink",
    ) -> AgentResult: ...

    def available(self) -> bool:
        """Cheap check: is the backend reachable without launching it?
        Default True; QwenAgent overrides to short-circuit when ollama is
        down or qwen is disabled."""
        return True
```

**What changed from v1:**

- **Dropped `Capability` Flag enum.** `READ_FILES` was "always true";
  `LONG_CONTEXT` was informational, never dispatched on; `VISION` was
  selected by role name, not capability. The only capability that matters
  is "can write", which is `writable: bool` on the subclass.
- **Dropped `cost_tier`.** No consumer in the design; not adding one.
- **Replaced `extra: Mapping[str, str]` in AgentSpec with per-Agent typed
  config dataclasses.** Each Agent subclass declares what it accepts
  (model, openai_logging, base_url, …) as fields with types and defaults.
  Pydantic loads YAML rows into the right config based on the `backend:`
  discriminator.
- **Added `FailureReason` enum.** Ports the bash failure vocabulary so
  the Role fallback decision and the telemetry consumer share the same
  type.
- **Added `UsageKind` enum and `AgentInvocation.usage_kind`.** Ports
  `HARNESS_USAGE_KIND`. The wrapper passes it to telemetry's
  `record_agent_usage` directly; no env-var indirection.
- **Dropped `AgentResult.diff`.** Computing a workspace diff per agent
  call has real cost (snapshot + git diff). v2 moves that responsibility
  to `scope_audit()` in `git_helpers.py`, called explicitly by the
  pipeline after a writable role.
- **Added `bucket: str` ("local" | "remote") on Agent.** Ports
  `agent_bucket_for_label` (lib.sh:382-401); consumed by the progress
  UI's GPU-uptime partition.

### 5.2 Concrete agents — typed configs

Each backend declares its own config; the Roster loader picks the right
one off the `backend:` discriminator in the YAML row.

```python
# harness/agents/cursor.py
@dataclass
class CursorAgentConfig:
    model: str                        # required — "composer-2.5-fast", "gpt-5.5-extra-high", etc.
    writable: bool = False            # --mode ask when False; no --mode when True


class CursorAgent(Agent):
    """
    Two operating modes per the TRUST CAVEAT documented in the bash
    run_agent_model_writable:

    - writable=True  → no --mode flag; agent can write files. Required for
      top-level reviewers (must write review.md / gaps.md / nits.md), for
      the implementer/decomposer roles, and for the rescue/split agents.
      CAVEAT: the agent CAN write anywhere in the workspace, including
      harness/. Mitigations: the prompt forbids edits outside the target
      files; a post-run scope_audit() (called by Role.execute, see §6.2)
      flags out-of-scope edits.

    - writable=False → --mode ask. Read-only — required for QA roles so
      the reviewer cannot edit the code it judges. KNOWN TRAP: under
      --mode ask the agent silently falls back to printing file contents
      in chat when asked to write a file. The QA prompts never ask for
      file writes, so this is safe there; do NOT use writable=False for
      the implementer or a top-level reviewer.
    """
    bucket = "remote"

    def __init__(self, cfg: CursorAgentConfig):
        self.cfg = cfg
        self.writable = cfg.writable
        self.name = f"cursor/{cfg.model}" + (" (writable)" if cfg.writable else " (ask)")

    def run(self, inv, ws, *, telemetry):
        argv = ["agent", "-p", "--force", "--trust", "--model", self.cfg.model]
        if not self.cfg.writable:
            argv += ["--mode", "ask"]
        argv.append(inv.prompt.body)
        return spawn(argv, invocation=inv, workspace=ws, telemetry=telemetry,
                     label=self.name, bucket=self.bucket)
```

```python
# harness/agents/qwen.py
@dataclass
class QwenAgentConfig:
    model: str | None = None           # None = qwen default
    openai_logging: bool = True
    # vision-specific fields, only used by QwenVisionAgent subclass:
    is_vision: bool = False
    vision_model: str = "qwen3.6:27b-q8_0"
    vision_base_url: str = "http://localhost:11434/v1"
    vision_api_key: str = "ollama"


class QwenAgent(Agent):
    """
    Local qwen-code CLI. Talks to Alibaba's API by default; the vision
    subclass points it at Ollama via QWEN_CODE_SYSTEM_SETTINGS_PATH.

    FAILURE MODES the wrapper handles (ports lib.sh _run_cli retries):
      - Empty stdout → FailureReason.EMPTY_OUTPUT, retry up to N
      - "exhausted your capacity" → QUOTA_OR_RATE_LIMIT
      - Hard timeout → TIMEOUT; SIGTERM, then SIGKILL after grace 30s

    available() returns False when QWEN_DISABLED=1 in tunables (mirrors
    today's runtime.env QWEN_DISABLED knob) — so removing qwen from the
    roster isn't the only way to take it offline; flipping the tunable
    is.
    """
    bucket = "local"

    def __init__(self, cfg: QwenAgentConfig):
        self.cfg = cfg
        self.writable = True             # qwen always writes when asked
        self.name = f"qwen/{cfg.model or 'default'}"

    def available(self) -> bool:
        return not get_tunables().qwen_disabled
```

```python
# harness/agents/agy.py
@dataclass
class AgyAgentConfig:
    model_label: str = "Gemini 3.5 Flash (High)"   # metadata only — no flag


class AgyAgent(Agent):
    """
    Antigravity CLI.

    PORTED-OVER QUIRK: there is NO --model flag; the model is pinned
    globally via the interactive `/model` slash command and persisted
    server-side. model_label is metadata-only — it does not control which
    model runs. If a future version exposes a flag we add it here.

    PORTED-OVER QUIRK 2: agy's print-mode workspaceDirs is always empty
    regardless of cwd. The Prompt renderer absolutizes all `@file`
    references so agy can resolve them; see prompts/renderer.py.

    PORTED-OVER QUIRK 3: agy's internal --print-timeout must be set from
    AGY_TIMEOUT so it doesn't cap below our outer timeout.

    REGRESSION TEST: a unit test in tests/unit/test_agy.py asserts that
    no --model arg ever appears in the argv. Past additions to a generic
    "if model: argv += ['--model', model]" snippet have broken agy.

    SPAWN RETRIES: AgyAgent passes retries=0 to spawn(). The bash today
    intentionally gives agy NO spawn-level retries (lib.sh _run_cli does
    not retry the agy-print flow on empty/timeout because agy's own
    --print-timeout already covers the timeout case and a retry would
    double-cost a slow tier). Role-level fallback to the next tier is
    still in effect; we just don't burn a second agy call.
    """
    bucket = "remote"
    writable = False                     # agy in our setup is read-only review

    def run(self, inv, ws, *, telemetry):
        argv = ["agy", "--print", "--print-timeout", str(inv.timeout_s), inv.prompt.body]
        return spawn(argv, invocation=inv, workspace=ws, telemetry=telemetry,
                     label=self.name, bucket=self.bucket, retries=0)   # the deliberate zero
```

```python
# harness/agents/claude.py
@dataclass
class ClaudeAgentConfig:
    model: str | None = None             # passes --model when set
    # dangerously-skip-permissions is always on for our autonomous loop


class ClaudeAgent(Agent):
    bucket = "remote"
    writable = True
```

### 5.3 The subprocess wrapper

```python
# harness/agents/spawn.py
def spawn(
    argv: list[str],
    *,
    invocation: AgentInvocation,
    workspace: "Repo",
    telemetry: "TelemetrySink",
    label: str,
    bucket: str,
    retries: int | None = None,        # None = use tunables.cli_retries; agents may override (AgyAgent → 0)
    retry_backoff_s: float | None = None,  # None = use tunables.cli_retry_backoff_s
    grace_kill_s: float = 30.0,
    output_watch: "OutputWatcher | None" = None,
) -> AgentResult:
    """
    The Python equivalent of bash _run_cli (lib.sh:731-805).

    - Spawns argv with cwd = workspace.root.
    - Captures stdout/stderr to invocation.out_file as it streams (tee).
    - Enforces timeout via subprocess.Popen + a timer thread that
      SIGTERMs at timeout_s, SIGKILLs at timeout_s + grace_kill_s.
    - Classifies the result into FailureReason via the same regex list
      ported from lib.sh:297-314 + the "exhausted your capacity" sentinel.
    - Retries on EMPTY_OUTPUT, API_ERROR_ONLY_OUTPUT, QUOTA_OR_RATE_LIMIT,
      TIMEOUT. NOT on EXIT_NONZERO (genuine task failure).
    - Records to telemetry on every attempt and the final result, with
      invocation.usage_kind and bucket so the progress UI partitions
      correctly.
    - Optional output_watch: a callback invoked on each stream chunk; can
      raise to early-kill (this is where Gemini's quota-mid-flight detect
      would have lived — see §10 note on Gemini retirement).

    NOTE on retry layering: spawn handles call-level retries. Role-level
    fallback (tier-promotion) lives in roles.py. Iteration-level retry
    (whole sub-ticket pass) lives in pipelines/subtask.py. Don't fold
    them.
    """
```

`spawn` is sync (uses `subprocess.Popen`). Day 1 needs no async because
the only concurrent thing in a sub-ticket is the background vitest run
(`steps/pipeline_checks.py`), which uses `threading.Thread` — much simpler
than `asyncio.create_subprocess_exec` and the function colors that come
with it.

When phase 6 introduces parallel workers, the worker pool can use
`concurrent.futures.ProcessPoolExecutor` to run multiple `subtask()`
functions concurrently. Still no `async def` needed — each worker is its
own subprocess with its own blocking I/O.

## 6. Role + Roster

### 6.1 Acceptance criteria

v1 had a single `VerdictParser` (parses a `^VERDICT: PASS|FAIL` line).
v2 generalizes to `AcceptanceCriterion` with three kinds, because the
top-level review role accepts on "the three files exist" rather than on
stdout content:

```python
# harness/prompts/acceptance.py
class AcceptanceCriterion(ABC):
    @abstractmethod
    def accepts(self, result: AgentResult, workspace: "Repo",
                artifacts_dir: Path) -> bool: ...


class VerdictAccept(AcceptanceCriterion):
    """Accepts when stdout has a `^VERDICT: PASS|FAIL` line. QA roles."""
    def __init__(self, pattern: str = r"^VERDICT:\s*(PASS|FAIL)\b"): ...


class ReviewAccept(AcceptanceCriterion):
    """
    Top-level review acceptance. Accepts when:
      1. review.md exists in artifacts_dir, AND
      2. review.md contains a verdict line.

    gaps.md and nits.md are OPTIONAL — gaps.md only exists when the
    reviewer found open gaps (i.e. on FAIL); nits.md only exists when the
    reviewer noted nits (independent of verdict). v2's
    FilesWrittenAccept(["review.md", "gaps.md", "nits.md"]) was wrong on
    both counts and would have failed every PASS-with-no-nits run.

    KNOWN TRAP (cursor --mode ask): a writable reviewer running under
    --mode ask falls back to printing file contents in chat. ReviewAccept
    runs `recover_review_files(result.stdout, artifacts_dir)` BEFORE the
    file-existence check, so the awk extractor's recovered review.md is
    accepted on the same tier rather than being treated as a failure that
    promotes to the next fallback.

    The recovery hook is intentionally inside ReviewAccept, not in the
    Role.execute loop, because (a) it's review-specific and (b) it must
    run after each tier returns, before the next tier is considered.
    """
    def __init__(self,
                 verdict_pattern: str = r"^VERDICT:\s*(PASS|FAIL|APPROVE|REJECT)\b",
                 review_filename: str = "review.md"):
        self.verdict_pattern = verdict_pattern
        self.review_filename = review_filename

    def accepts(self, result, workspace, artifacts_dir):
        review_path = artifacts_dir / self.review_filename
        if not review_path.exists():
            # Try the chat-mode recovery before declaring this tier failed.
            recover_review_files(result.stdout, artifacts_dir)
        if not review_path.exists():
            return False
        return bool(re.search(self.verdict_pattern, review_path.read_text(), re.MULTILINE))


class OkRcAccept(AcceptanceCriterion):
    """Accepts on AgentResult.ok. Used by roles that don't produce a
    verdict and don't write files (e.g. the implementer — its 'success'
    is measured later by the pipeline)."""
```

A role's YAML row picks one criterion. Roles with no acceptance
criterion (only OkRcAccept) treat any tool-failure as the only reason to
fall through.

### 6.2 Role + ChainResult

```python
# harness/roles.py
@dataclass
class Role:
    name: str                          # "implementer" | "qa:code" | "qa:visual" | "decomposer" | "review" | ...
    primary: Agent
    fallbacks: list[Agent]
    timeout_s: float
    prompt_template: Path
    acceptance: AcceptanceCriterion
    out_file: str
    usage_kind: UsageKind
    scope: PathScope                   # used by Role.execute → scope_audit for writable agents


@dataclass
class TierResult:
    agent: Agent
    result: AgentResult                # if scope_audit downgraded the tier, result.reason is SCOPE_VIOLATION
    accepted: bool
    reason_for_skip: FailureReason | str  # FailureReason if tool/scope issue; str if "no verdict"
    scope_audit: "ScopeAuditResult | None"  # populated for writable agent tiers; None for read-only


@dataclass
class ChainResult:
    tiers: list[TierResult]
    accepted_by: Agent | None     # None if exhausted

    @property
    def final(self) -> AgentResult:
        return self.tiers[-1].result


class Role:
    def execute(self, workspace: "Repo", prompt_vars: dict, *, telemetry) -> ChainResult:
        """
        Try primary, then each fallback in order. Per-tier sequence:

          1. If agent.writable: snapshot
                head_before       = workspace.head()
                untracked_before  = snapshot_untracked(workspace)
             Both snapshots are needed by scope_audit (§7.4) to tell
             agent-created files apart from pre-existing stale untracked
             files. Skip for read-only agents — nothing to audit.
          2. result = agent.run(invocation, workspace, telemetry=…).
          3. If agent.writable:
                audit = scope_audit(workspace, head_before,
                                    untracked_before, self.scope)
             scope_audit reverts in-line (see §7.4) — caller does not
             call revert separately. If audit.had_violations:
               - result = dataclasses.replace(result,
                            reason=FailureReason.SCOPE_VIOLATION)
                 (AgentResult is a @dataclass; the NamedTuple-style
                 `result._replace(...)` does not exist on it.)
               - skip acceptance check; record TierResult(accepted=False,
                 scope_audit=audit), move to next tier.
          4. If result.ok AND acceptance.accepts(result, workspace,
             artifacts_dir):
             record TierResult(accepted=True, scope_audit=audit_or_None),
             return ChainResult.
          5. Else: record TierResult(accepted=False, reason_for_skip=…,
             scope_audit=audit_or_None), move to next tier.

        Owning scope_audit here (rather than in the pipeline functions)
        means:
          - Every writable role tier is audited automatically — no caller
            can forget (v3 forgot implementer/rescue/split/repair).
          - The §7.4 "downgrade tier so chain falls through" semantics
            actually work: a violating primary triggers the fallback
            chain naturally, instead of requiring the caller to detect
            the violation after Role.execute returns and somehow retry.
          - The scope check happens BEFORE acceptance, so an agent that
            both violated scope AND happened to produce a verdict is
            still rejected on the scope grounds.

        On exhaustion, accepted_by is None — caller decides whether to
        escalate (TOOL_FAILURE rc=2) or to treat the chain failure as a
        recoverable task failure (e.g. ticket() falls through to rescue
        when all review tiers are exhausted).
        """
```

A note on cost: snapshotting `head_before` is a single `git rev-parse
HEAD` (~ms). `scope_audit()` runs two git commands (~10ms each). For
read-only roles the audit is skipped entirely. This is cheap enough to
run on every writable tier; the safety benefit is high enough that
"cheap" doesn't need defending.

### 6.3 `roles.yaml` — named agents, parameterized review, tunables

```yaml
# harness/roles.yaml — committed; the canonical roster.
# Override per-experiment via roles.local.yaml (gitignored).

schema_version: 1

# --- Non-role tunables (ports the lib.sh `${X:-default}` block) ---
# These replace today's runtime.env mechanism for the SAME purpose:
# live-tweak the supervisor without restart, taking effect at next
# supervisor invocation (NOT mid-ticket; see §6.5).
tunables:
  max_iter: 5                      # MAX_ITER — sub-ticket iteration cap
  ticket_max_rounds: 10            # TICKET_MAX_ROUNDS — decompose → subs → review rounds
  game_url: "http://localhost:5173"
  pipeline:
    local_checks: true             # PIPELINE_LOCAL_CHECKS
    check_cwd: "game"
    server_timeout_s: 300
    client_timeout_s: 120
    coverage_enabled: true         # PIPELINE_COVERAGE_ENABLED
    coverage_timeout_s: 120
  vision:
    feedback_on_fail: true         # QWEN_VISION_FEEDBACK
    timeout_s: 900
  qwen_disabled: false             # short-circuits QwenAgent.available()
  cli_retries: 2                   # spawn() retry cap; CLI_RETRIES
  cli_retry_backoff_s: 20          # spawn() retry sleep; CLI_RETRY_BACKOFF
  agent_timeout_s: 720             # default per-call ceiling for cursor/agy

# --- Named agent instances ---
agents:
  qwen:                  { backend: qwen }
  qwen_vision:           { backend: qwen, is_vision: true, vision_model: "qwen3.6:27b-q8_0" }
  composer_fast_write:   { backend: cursor, model: composer-2.5-fast, writable: true }
  composer_fast_read:    { backend: cursor, model: composer-2.5-fast, writable: false }
  composer_write:        { backend: cursor, model: composer-2.5,      writable: true }
  composer_read:         { backend: cursor, model: composer-2.5,      writable: false }
  gpt5_medium_write:     { backend: cursor, model: gpt-5.5-medium-fast, writable: true }
  gpt5_extra_write:      { backend: cursor, model: gpt-5.5-extra-high,  writable: true }
  agy:                   { backend: agy, model_label: "Gemini 3.5 Flash (High)" }
  claude:                { backend: claude }

# --- Role defaults (per family) ---
_role_defaults:
  qa: &qa_default
    acceptance: { kind: verdict, pattern: '^VERDICT:\s*(PASS|FAIL)\b' }
    out_file: "qa.txt"
    timeout_s: 720
    usage_kind: qa
  review: &review_default
    acceptance: { kind: review, review_filename: "review.md" }
    out_file: "review-attempt.txt"
    timeout_s: 720
    usage_kind: final_review

roles:

  # === Sub-ticket roles (called from pipelines/subtask.py) ===

  implementer:
    primary: qwen
    fallbacks: []                  # no fallback — see §6.4
    timeout_s: 7200
    out_file: "qwen.txt"
    prompt_template: prompts/implement.md
    acceptance: { kind: ok_rc }    # success measured downstream by QA, not by implementer stdout
    usage_kind: implementer

  qa:code:
    <<: *qa_default
    primary: qwen
    fallbacks: [composer_fast_read, agy, claude]
    prompt_template: prompts/qa-code.md

  qa:visual:
    <<: *qa_default
    primary: qwen
    fallbacks: [composer_fast_read, agy, claude]
    prompt_template: prompts/qa.md

  committer:
    primary: qwen
    fallbacks: []                  # commit_with_role()'s deterministic fallback covers failure
    timeout_s: 600
    out_file: "commit.txt"
    prompt_template: prompts/commit.md
    acceptance: { kind: ok_rc }
    usage_kind: committer

  vision_feedback:
    primary: qwen_vision
    fallbacks: []
    timeout_s: 900
    out_file: "qwen-vision.txt"
    prompt_template: prompts/qwen-vision-feedback.md
    acceptance: { kind: ok_rc }
    usage_kind: vision

  # === Ticket roles (called from pipelines/ticket.py) ===

  decomposer:
    primary: qwen
    fallbacks: []
    timeout_s: 1800
    out_file: "decompose.txt"
    prompt_template: prompts/decompose.md
    acceptance: { kind: ok_rc }
    usage_kind: decomposer

  # One parameterized review role with a per-difficulty primary.
  # v1 had three separate roles (review:easy/medium/hard); both reviewers
  # noted that's just boilerplate. The Roster builds the right concrete
  # Role for a given ticket's difficulty via `roster.role("review",
  # difficulty=t.difficulty)`.
  #
  # `fallbacks` is the default chain used for any difficulty that doesn't
  # declare its own. `fallbacks_by_difficulty:` (optional) lets the hard
  # tier (or any other) override — e.g. an extra-high primary shouldn't
  # fall back to composer-2.5 because the whole point was that composer
  # couldn't handle it.
  review:
    <<: *review_default
    primary_by_difficulty:
      easy:   composer_write
      medium: gpt5_medium_write
      hard:   gpt5_extra_write
    fallbacks: [composer_write, claude]               # default fallback chain
    fallbacks_by_difficulty:                          # optional per-difficulty override
      hard: [claude]                                  # extra-high → claude (skip composer-2.5)
    prompt_template: prompts/review.md

  # === Recovery roles (called from pipelines/ticket.py late stages) ===

  rescue:
    primary: claude
    fallbacks: []                  # rescue failure → split is the next step
    timeout_s: 1800
    out_file: "rescue.txt"
    prompt_template: prompts/rescue.md
    acceptance: { kind: ok_rc }
    usage_kind: rescue

  split:
    primary: claude
    fallbacks: []                  # split failure → ticket stays open
    timeout_s: 1800
    out_file: "split.txt"
    prompt_template: prompts/split.md
    acceptance: { kind: ok_rc }
    usage_kind: split

  # === Supervisor role ===

  repair:
    primary: claude
    fallbacks: []
    timeout_s: 900
    out_file: "diagnosis.txt"
    prompt_template: prompts/diagnose.md
    acceptance: { kind: ok_rc }
    usage_kind: repair
```

### 6.4 Why implementer has no fallbacks

The implementer is the only role that mutates `game/` files mid-iteration.
If primary implementer fails, the right answer is to retry next iteration
(with the synthesized handoff explaining what went wrong) — NOT to silently
let a fallback agent take over, because the fallback's coding style and
assumptions differ enough that the resulting diff becomes a mess. Today's
bash mirrors this: `run_qwen` / `run_impl` for the implementer has
spawn-level retries but no per-call fallback to a different agent.

If you want a different agent to implement, change the primary in YAML.

Same logic for committer (deterministic fallback covers failure), rescue,
split, and repair (each has a different failure-handling pipeline).

### 6.5 Hot-reload semantics — one boundary

v1 said "reload per Pipeline construction" — but ticket-level roles
(decomposer, review, rescue, split) only ever construct once per ticket,
while sub-ticket roles construct once per sub-ticket. Operators editing
`roles.local.yaml` mid-ticket got inconsistent application; both reviewers
flagged this as a footgun.

v2: **reload only at top-level supervisor invocation.** The Supervisor
process loads `roles.yaml` + `roles.local.yaml` once at start; that
roster is passed by reference into every pipeline call. To pick up YAML
changes, send SIGHUP to the supervisor (or kill+restart). One boundary,
zero surprise. Operators wanting per-ticket reloads can stop the
supervisor between tickets.

This is a deliberate ergonomic step back from the current `runtime.env`
behavior, which re-sources per sub-ticket spawn. The bash behavior is
incidental (because every `bash run_subtask.sh` is a fresh process); the
Python equivalent requires explicit work to support, and the surprise
cost (mid-ticket value changes confusing the operator) outweighs the
benefit.

### 6.6 `roles.local.yaml` — field-level merge

v1 said `roles.local.yaml` replaces a role entirely. v2 does field-level
merge: any field present in `roles.local.yaml` overrides the same field in
`roles.yaml`; absent fields fall through.

```yaml
# roles.local.yaml — gitignored
roles:
  implementer:
    primary: composer_fast_write     # everything else inherited from roles.yaml
    fallbacks: [qwen]
    timeout_s: 1800                  # override timeout for the experiment
  qa:code:
    primary: composer_read           # use composer-2.5 as primary; chain inherited
```

Pydantic does this via `model.model_copy(update=fields_from_local)` per
role. The roster's loader walks each role and applies the local override
as a partial dict.

**Recursive merge for nested maps; list-replace for lists.** The
`tunables` section has nested objects (`tunables.pipeline.*`,
`tunables.vision.*`); each leaf field merges independently — setting
`tunables.pipeline.server_timeout_s` in `roles.local.yaml` does NOT
require restating `tunables.pipeline.client_timeout_s`. Lists, by
contrast, replace wholesale: `fallbacks: [composer_write, claude]` in
the base + `fallbacks: [claude]` in local yields `[claude]` only, not
`[composer_write, claude, claude]`. This is the safer default — most
list overrides are "use exactly this chain, not a partial subset of the
old one." For per-difficulty fallback overrides, use
`fallbacks_by_difficulty.<diff>` rather than mutating `fallbacks`.

Edge case: when a role in `roles.local.yaml` references an agent name not
in `roles.yaml`'s `agents:`, the loader expects that name to also appear
in a `roles.local.yaml` `agents:` block (which is merged into the base
`agents:` map before role resolution). Loader fails fast with the
unresolved name if not.

## 7. Workspace

### 7.1 Day 1: one concrete `Repo` class

```python
# harness/workspace/repo.py
@dataclass
class PortAllocation:
    game_server: int = 3000          # day 1: fixed
    vite: int = 5173                 # day 1: fixed


class Repo:
    """
    Wraps the main checkout. Single writer, single set of ports.

    Day 1 does NOT extract an ABC. v1's Workspace ABC existed entirely to
    parallel the future WorktreeWorkspace, and both reviewers flagged
    that as premature: the interface should fall out of the diff when
    the second concrete class arrives, not before.
    """
    root: Path                       # repository root
    ports: PortAllocation
    branch: str                      # "main" day 1
```

Plain methods, not interfaces:
- `repo.diff_since(ref: str, paths: list[str]) -> str`
- `repo.status_porcelain(paths: list[str]) -> str`
- `repo.head() -> str`
- `repo.tag(name: str, message: str | None = None) -> None`
- `repo.commit(message: str, paths: list[str]) -> CommitResult` — stages the named paths only (does NOT use `git add -A`)
- `repo.checkout(paths: list[str]) -> None` — used by `revert_game_changes`
- `repo.chmod(path: Path, mode: int) -> None` — used by `protect_review`

Path-scope (the v1 `PathScope` class on Workspace) is gone. The role's
allow/deny list is consumed by `git_helpers.scope_audit()`, invoked from
inside `Role.execute()` (§6.2) for any writable agent tier. Workspace
itself does not encode role policy.

### 7.2 Phase 6 — extract `WorktreeWorkspace`

When the parallel-workers PR arrives, `WorktreeWorkspace` is the second
concrete class. At that point: read both classes side by side, extract
the actual shared seams into an ABC. Likely fields:
- `root: Path`
- `ports: PortAllocation`
- `branch: str`
- the git helpers above
- an `acquire()` / `release()` for the worker checkout lifecycle

`merge_into_main()` doesn't exist on day-1 `Repo` (no-op smell from v1
gone). The merge queue is a separate `merge_queue.py` module that
operates on `WorktreeWorkspace` instances.

### 7.3 PortAllocator

Day 1 returns the constant pair. Phase 6 introduces a pool. The game
currently hard-codes its ports (`port 3000` on server, `5173` on vite);
phase 6 will need a tiny game-side change to accept `--server-port` /
`--vite-port` flags. Documented as a phase-6 prerequisite, not blocking.

### 7.4 `scope_audit()` — the algorithm

Both reviewers correctly flagged that the v2 design promised
`scope_audit()` would "revert out-of-scope edits and downgrade to
TOOL_FAILURE" without specifying what that means. Concretely:

```python
# harness/git_helpers.py
@dataclass
class PathScope:
    allow: list[str]                 # glob patterns; matches any → in-scope
    deny: list[str]                  # glob patterns; matches any → out-of-scope (even if in allow)

def snapshot_untracked(workspace: Repo) -> set[Path]:
    """The set of untracked paths in the workspace right now. Captured
    by Role.execute / the fixture recorder right before agent.run() so
    scope_audit can distinguish 'created by THIS agent call' from
    'untracked stale file that was already here'."""
    out = workspace.run_git("status", "--porcelain", "--untracked-files=all")
    return {Path(line[3:]) for line in out.splitlines() if line.startswith("?? ")}


def scope_audit(
    workspace: Repo,
    head_before: str,                # workspace.head() captured before the role ran
    untracked_before: set[Path],     # snapshot_untracked() captured before the role ran
    scope: PathScope,
) -> ScopeAuditResult:
    """
    Detect, classify, and revert out-of-scope edits made between
    (head_before, untracked_before) and the current working tree state.

    Detection (TWO sources; either alone misses cases):

      1. TRACKED changes (modifications to files git already knows about):
         git diff --name-status <head_before> -- :(top)
         → list of (status, path) where status in {A,M,D,R}
         (A here means "added in a commit since head_before"; for the
         common case where the agent didn't commit, A doesn't appear and
         everything new shows up via source #2 below.)

      2. UNTRACKED changes (files the agent CREATED without staging):
         post = snapshot_untracked(workspace)
         new_untracked = post - untracked_before
         → each path in new_untracked is treated as status A.
         (Lines starting with " M", "MM", " D", etc. in `git status`
         are tracked changes already covered by source #1; skip them
         here. Files in `untracked_before` are stale — operator
         scratch files, earlier-crash artifacts, etc. — and must NOT
         be treated as "agent created"; v4 had this bug and would
         have deleted them.)

      Combined: union both sources by path, with source #1 winning on
      conflicts (tracked status more specific than ??). v3 used only
      source #1 and missed every untracked file. v4 added source #2
      but lacked the pre-call baseline. v5 adds the baseline so
      `agent created` is correctly distinguished from `pre-existing
      untracked`.

    Classification per path (in this order):
      - DENY-match → out-of-scope (always; explicit deny wins)
      - ALLOW-match → in-scope
      - neither    → out-of-scope (implicit deny; "not allowed" == "not
                     in the listed set")

    Revert action per out-of-scope path, by status:
      - A (added): rm -f <path>          # role created a file outside scope
      - M (modified): git checkout head_before -- <path>
      - D (deleted): git checkout head_before -- <path>
      - R (renamed): git checkout head_before -- <old_path> <new_path>
                     (restores both; defensive)

    Rename across scopes is the trickiest case. Example: scope =
    {allow: ["game/**"]}, role renamed game/foo.js → harness/foo.js.
    The 'R' entry surfaces as one logical change with both paths
    appearing; the audit restores both, so the rename is fully undone.

    Result:
      ScopeAuditResult(
        in_scope=[…],          # path list
        out_of_scope=[…],      # path list (these were reverted)
        had_violations=bool,   # True if out_of_scope non-empty
      )

    Caller side (post-v4 design): NOT the pipeline functions.
    `Role.execute()` owns the response to `had_violations` per §6.2:
    it downgrades the tier's AgentResult to FailureReason.SCOPE_VIOLATION
    and falls through to the next tier in the role's fallback chain.
    Per-role end-state, expressed as "what falling-through means":
      - Implementer (fallbacks=[]): chain exhausts; subtask() sees
        TOOL_FAILURE and retries the iteration (next iteration sees
        an unchanged workspace because scope_audit already reverted).
      - Top-level review (fallbacks=[...]): chain naturally falls
        through to next reviewer; if all tiers violate scope, ticket()
        sees accepted_by=None and escalates (rc=2).
      - Rescue / split (fallbacks=[]): chain exhausts; ticket()
        treats as task failure and falls through to the next recovery
        step (rescue→split, split→leave-open).
      - Repair (fallbacks=[]): chain exhausts; supervisor sees a
        failed repair_pass() return and counts the escalation without
        retrying repair (the repair role is intentionally last-resort,
        not a re-tryable one).
    Pipeline functions don't call scope_audit directly; they only
    consume the resulting ChainResult, which Role.execute has already
    pre-processed.

    SCOPE_VIOLATION is added to the FailureReason enum in §5.1.
    """
```

**Why revert at all** (not just flag): the next iteration / next tier
needs a clean workspace to re-attempt against. Leaving out-of-scope
edits in place would contaminate the diff the next role sees and the
QA reads.

**Why not just disallow the agent from writing those paths in the first
place** (e.g. chroot, mount-bind): cursor-agent and claude have no
sandbox we control; their toolset writes through OS filesystem calls.
Post-hoc audit + revert is the realistic enforcement.

**Test fixtures** (called out in §11.1): unit tests for `scope_audit`
cover (a) clean diff in-scope → no-op, (b) modified file out-of-scope →
reverted, (c) created file out-of-scope → rm -f'd, (d) deleted file
out-of-scope → restored, (e) rename across scopes → both paths
restored, (f) deny pattern wins over allow pattern (the case where a
file matches both).

## 8. Pipelines — plain Python functions

v1 had a `Step` ABC plus 10+ combinators (`SequenceStep`, `ParallelStep`,
`BranchStep`, …). v2 deletes all of that. Pipelines are functions; control
flow is `if`/`for`/`while`. The advantages are real: ordinary stack traces
on failure, regular Python debuggers, no framework to learn, code reads
top-to-bottom like the bash did.

The shared signature: each pipeline function takes a `Context` dataclass
carrying the workspace, roster, tunables, telemetry, and per-pipeline
artifact dir. Steps inside the function call `role.execute()`,
`background_vitest()`, etc., directly.

#### Context derivation: `ticket_allows_harness`

The `SubtaskContext.ticket_allows_harness` flag controls whether the
implementer (and the post-commit dirtiness check) may touch `harness/`.
Ported verbatim from `run_subtask.sh:35-38`:

```python
def detect_ticket_allows_harness(ticket_file: Path) -> bool:
    """A ticket allows harness/ edits iff its ticket.md references a
    harness/ path. Detection: regex over the file body."""
    text = ticket_file.read_text()
    return bool(re.search(r'(^|[^A-Za-z0-9_./-])harness/', text))
```

Same regex as the bash. The flag is set once when the SubtaskContext is
constructed (at the top of `subtask()`), passed through to the
implementer Role's `scope` (which uses it to widen `PathScope.allow`
from `["game/**"]` to `["game/**", "harness/**"]` for harness-tagged
tickets), and consumed by `allowed_commit_paths()` to scope
`commit_verified`.

#### SCOPE-CONFLICT sentinel helper

Per Q11: the implementer writes `<!-- HARNESS:SCOPE-CONFLICT -->` into
its `handoff.md` when it judges an AC unfixable in the current
sub-ticket's scope. The detection helper:

```python
def scope_conflict_sentinel_in(handoff: Path) -> bool:
    """Detect the implementer's SCOPE-CONFLICT marker in handoff.md.

    The marker is a single-line HTML comment that the implementer
    writes (per the prompt change shipping in a separate PR — see Q11);
    any line containing the exact substring '<!-- HARNESS:SCOPE-CONFLICT -->'
    counts. False if handoff.md does not exist or contains no marker.
    Cheap; called once per implementer iteration."""
    if not handoff.exists():
        return False
    return "<!-- HARNESS:SCOPE-CONFLICT -->" in handoff.read_text()
```

### 8.1 `subtask()` (replaces run_subtask.sh)

```python
# harness/pipelines/subtask.py
def subtask(ctx: SubtaskContext) -> int:
    """
    Inner loop for one sub-ticket. Returns:
       0  = passed (committed)
       1  = failed after MAX_ITER
       2  = tool failure (escalate)
       3  = SCOPE-CONFLICT sentinel (implementer flagged unfixable-in-scope
            ACs; route to next-round decomposer per the user's planned
            [[scope-conflict-sentinel]] behavior)

    Replaces harness/run_subtask.sh.
    """
    log_subtask_start(ctx)
    coder_toolfail = 0

    for iteration in range(1, ctx.tunables.max_iter + 1):
        arti = ctx.subdir / "artifacts" / f"iter-{iteration}"
        arti.mkdir(parents=True, exist_ok=True)
        emit_iteration_start(ctx, iteration, arti)

        # --- 1. IMPLEMENT ---
        implementer = ctx.roster.role("implementer")
        prompt = render_prompt(implementer.prompt_template, ticket_file=ctx.ticket_file,
                               feedback_file=ctx.feedback, handoff_file=ctx.handoff)
        handoff_hash_before = sha256_of(ctx.handoff) if ctx.handoff.exists() else None
        chain = implementer.execute(ctx.workspace, {"prompt": prompt}, telemetry=ctx.telemetry)
        coder_result = chain.final

        # Synthesize a handoff if the implementer left none. v1 compared mtimes;
        # v2 compares content hashes because the bash mtime path was wrong on
        # fast machines.
        ensure_handoff(ctx.handoff, before_hash=handoff_hash_before,
                       attempt=iteration, coder_result=coder_result)

        # SCOPE-CONFLICT sentinel: implementer writes a specific marker into
        # handoff.md when it judges an AC unfixable in the current sub-ticket
        # scope; harness exits 3 so the next ticket round can re-decompose.
        # (Future state per memory; the check is wired in but the prompt
        # change ships in a later commit.)
        if scope_conflict_sentinel_in(ctx.handoff):
            log("[scope-conflict] implementer flagged unfixable-in-scope ACs — exiting 3")
            return 3

        if not coder_result.ok:
            coder_toolfail += 1
            log(f"[tool-failure] implementer call failed ({coder_toolfail} consecutive)")
            if coder_toolfail >= 2:
                return 2
            continue
        coder_toolfail = 0

        # --- 2. PIPELINE CHECKS (background) + GAME (foreground) ---
        # Threaded vitest run; main thread starts the game and screenshots.
        # Writes local-checks.status.json artifact when the thread finishes.
        pipeline_handle = background_vitest(arti, ctx.tunables) if ctx.tunables.pipeline.local_checks else None
        game_live = False
        if start_game(arti, ctx.workspace.ports):
            game_live = wait_for_game(45)
            if game_live:
                capture_screenshots(ctx.workspace.ports.vite, arti)
                emit_capture_complete(ctx, iteration, arti, status="captured")
            else:
                log("[game] SERVERS FAILED TO START")
                emit_capture_complete(ctx, iteration, arti, status="servers_failed")
        # Keep the game running through visual QA only if vision feedback is on.
        if not (game_live and ctx.qa_mode == "visual" and ctx.tunables.vision.feedback_on_fail):
            stop_game()

        write_diff(ctx.workspace, arti / "changes.diff",
                   paths=["game/"] if not ctx.ticket_allows_harness else [".", ":!tickets"])
        finish_background_vitest(pipeline_handle, arti)

        # --- 3. QA ---
        qa_role = ctx.roster.role(f"qa:{ctx.qa_mode}")
        qa_prompt = render_prompt(qa_role.prompt_template, ticket_file=ctx.ticket_file,
                                  artifacts_dir=arti)
        qa_chain = qa_role.execute(ctx.workspace, {"prompt": qa_prompt}, telemetry=ctx.telemetry)
        if qa_chain.accepted_by is None:
            log("[tool-failure] all QA tiers exhausted with no verdict — escalating")
            return 2
        emit_qa_verified(ctx, iteration, agent=qa_chain.accepted_by, mode=ctx.qa_mode)

        # --- 4. VERDICT ---
        verdict = parse_verdict(qa_chain.final.stdout)
        emit_qa_verdict(ctx, iteration, verdict, qa_file=arti / "qa.txt")
        if verdict == "PASS":
            stop_game()
            head_before = ctx.workspace.head()
            commit_with_role(ctx.roster.role("committer"), ctx, arti,
                             fallback_message=f"{ctx.label}: sub-ticket verified (iter {iteration})")
            mark_passed(ctx.subdir)
            log(f"=== sub-ticket PASSED: {ctx.label} ===")
            emit_subtask_passed(ctx, iteration)
            return 0

        # FAIL — accumulate feedback, optional vision feedback, next iteration
        log("[qa] FAIL — accumulating feedback")
        if ctx.qa_mode == "visual" and ctx.tunables.vision.feedback_on_fail:
            optional_vision_feedback(ctx.roster.role("vision_feedback"), ctx, arti)
        stop_game()
        accumulate_feedback(
            ctx.feedback,
            iteration=iteration,
            qa_text=filter_agent_feedback_noise((arti / "qa.txt").read_text()),
        )

    # MAX_ITER exhausted without PASS
    log(f"=== sub-ticket FAILED after {ctx.tunables.max_iter} iterations: {ctx.label} ===")
    revert_game_changes(ctx.workspace)
    return 1
```

Reads top-to-bottom; no combinators. Errors stack-trace through the
function. Setting a breakpoint at `if verdict == "PASS"` works in any
debugger.

### 8.2 `ticket()` (replaces run_ticket.sh)

The ticket function is bigger because run_ticket.sh has more machinery
(rescue, split, finalize, protect_review, capture_run, coverage, ingest
nits). Helper enum used by the skeleton below:

```python
# harness/steps/finalize.py
class FinalizeResult(Enum):
    SUCCESS       = "success"        # tagged, LOGBOOK updated, TASKS.md flipped, nits ingested
    GAME_BROKEN   = "game_broken"    # review PASS but game_smoke_ok + confirm_game_broken both failed
    COMMIT_FAILED = "commit_failed"  # commit_verified failed inside finalize — escalate
```

The skeleton:

```python
# harness/pipelines/ticket.py
def ticket(ctx: TicketContext) -> int:
    """
    Top-level ticket loop. Returns:
       0 = ticket complete (tagged + LOGBOOK updated + TASKS.md flipped)
       1 = ticket genuinely incomplete (review failed and rescue+split didn't recover)
       2 = harness/tool failure (escalate to supervisor)
       3 = ticket split into smaller tickets — backlog should re-scan

    Replaces harness/run_ticket.sh. Control flow notes:
      - sub_rc == 0 → sub-ticket passed; continue to next sub
      - sub_rc == 1 → sub-ticket FAILED after MAX_ITER; record in
        failed_subs, skip review this round, continue to next round with
        a put_review_fb summary (ports run_ticket.sh:399-436)
      - sub_rc == 2 → tool failure; escalate immediately
      - sub_rc == 3 → SCOPE-CONFLICT sentinel from implementer; set
        `rescope_round` flag and break the sub loop so the round loop
        re-decomposes next iteration (does NOT run review/coverage/
        capture_run on an incomplete sub set)
    """
    base_ref = ctx.workspace.head()       # for git diff base in coverage and review
    log_ticket_start(ctx)
    review_fb = ctx.tdir / "review-feedback.md"

    # --- 1. DECOMPOSE → SUB-TICKETS → REVIEW (per round) ---
    for round_n in range(1, ctx.tunables.ticket_max_rounds + 1):
        log_round_start(ctx, round_n)

        # Decomposer. Distinguish two failure modes that look the same in
        # subs == [] but mean different things (ports run_ticket.sh:380-395):
        decomp_chain = decompose(ctx, round_n, review_fb)
        verify_reviews(ctx.reviews_dir, ctx.tdir)      # integrity check + restore-from-archive

        subs = list_subticket_dirs(ctx.subroot)
        if not subs:
            if not decomp_chain.final.ok:
                # The decompose CALL failed (timeout/crash/empty). Don't
                # synthesize a single-sub from it — that would burn MAX_ITER
                # on a too-big task. Retry decomposition next round.
                log(f"[decompose] decomposition call FAILED (rc={decomp_chain.final.rc}) — re-decomposing next round")
                continue
            # decompose ran fine and chose not to split — atomic ticket.
            log("[decompose] no sub-tickets produced — using ticket as a single sub-task")
            seed_single_sub(ctx)
            subs = list_subticket_dirs(ctx.subroot)

        # Run sub-tickets (skip ones already .passed). Collect failures.
        failed_subs: list[str] = []
        rescope_round = False
        for sub in subs:
            if sub.has_marker(".passed"):
                continue
            sub_rc = subtask(sub.context(ctx))
            if sub_rc == 0:
                continue
            if sub_rc == 1:
                failed_subs.append(sub.label)
                # Keep going — other subs in this round still get a chance.
                # Bash does the same (run_ticket.sh:415-422). We accumulate
                # all failures and emit them as a single feedback block at
                # the bottom of the round.
                continue
            if sub_rc == 2:
                return 2                  # tool failure escalates immediately
            if sub_rc == 3:
                # SCOPE-CONFLICT sentinel: implementer flagged that an AC
                # is unfixable in the current sub-ticket's scope. Re-
                # decompose next round; do NOT run review on a partial
                # sub set.
                log(f"[scope-conflict] sub {sub.label} flagged — re-decomposing next round")
                rescope_round = True
                break

        if rescope_round:
            # Carry the SCOPE-CONFLICT note into review_fb so the next
            # round's decomposer sees the explanation from the previous
            # implementer's handoff.md.
            carry_scope_conflict_into_feedback(ctx, review_fb)
            continue

        if failed_subs:
            # Sub-set incomplete — skip review/coverage/capture_run this
            # round (bash run_ticket.sh:425-436). Write a compact summary
            # so the next round's decomposer can see what failed.
            log(f"[round {round_n}] {len(failed_subs)} sub-ticket(s) failed: {', '.join(failed_subs)}")
            with put_review_fb(review_fb) as f:
                f.write(f"# Round {round_n}: sub-tickets failed before review ({now()})\n\n")
                f.write(f"The following sub-tickets exhausted MAX_ITER without passing QA:\n\n")
                for label in failed_subs:
                    f.write(f"- `{label}` — see `{ctx.subroot}/{label}/log.txt`\n")
                f.write("\nReview was skipped this round — re-decompose to address these.\n")
            continue

        # --- 2. CAPTURE_RUN + COVERAGE + REVIEW (only if ALL subs passed) ---
        rdir = ctx.tdir / f"round-{round_n}"
        rdir.mkdir(parents=True, exist_ok=True)
        capture_run(ctx, rdir)
        coverage_dir = rdir / "coverage" if ctx.tunables.pipeline.coverage_enabled else None
        if coverage_dir:
            coverage_run(ctx.workspace, base_ref, coverage_dir)
            # The review.md prompt template references coverage.log inside
            # ARTIFACTS_DIR (the rdir); the coverage runner writes it
            # inside coverage_dir. Copy so the reviewer prompt resolves.
            shutil.copy(coverage_dir / "coverage.log", rdir / "coverage.log")

        difficulty = ticket_difficulty(ctx.ticket_file)
        review_role = ctx.roster.role("review", difficulty=difficulty)
        review_chain = review_role.execute(
            ctx.workspace,
            {"ticket_file": ctx.ticket_file, "artifacts_dir": rdir,
             "review_fb": review_fb, "coverage_dir": coverage_dir,
             "base_ref": base_ref},
            telemetry=ctx.telemetry,
        )
        # ReviewAccept runs recover_review_files internally on each tier
        # BEFORE deciding the tier failed. Role.execute owns scope_audit
        # internally too (see §6.2): any reviewer that touched paths
        # outside its role.scope had its tier auto-downgraded to
        # SCOPE_VIOLATION and the chain fell through to the next fallback.
        # If accepted_by is still None, every tier produced neither a
        # written-nor-recoverable review.md, OR every tier hit scope
        # violations that exhausted the chain.
        if review_chain.accepted_by is None:
            # Distinguish exhaustion-by-no-verdict from exhaustion-by-scope
            # so the operator can see which it was. Both cases escalate.
            if all(t.scope_audit and t.scope_audit.had_violations for t in review_chain.tiers if t.scope_audit):
                log("[review] all tiers had scope violations — escalating")
            else:
                log("[review] all tiers exhausted without a usable review — escalating")
            return 2

        # protect_review chmods the archive (and the working files) to
        # a-w. Subsequent reads (is_pass(rdir/"review.md"), finalize()
        # opening review.md) are fine — read does not require write.
        # The chmod is for tamper detection, not access control.
        protect_review(label=f"round-{round_n}", working_dir=rdir,
                       archive_dir=ctx.reviews_dir)

        review_out = rdir / "review.md"
        if is_pass(review_out):
            finalize_result = finalize(ctx, rdir, review_out)
            if finalize_result == FinalizeResult.SUCCESS:
                return 0
            if finalize_result == FinalizeResult.GAME_BROKEN:
                # Review passed but game smoke + confirm both failed.
                # NOT a tagged ticket; fall through into next round (or rescue).
                log("[finalize] review passed but game broken — continuing")
            elif finalize_result == FinalizeResult.COMMIT_FAILED:
                # commit_verified failed inside finalize — bash exits 2;
                # we escalate so the supervisor's repair pass can look.
                log("[finalize] commit_verified failed — escalating")
                return 2

        # Round failed (or finalize rejected): accumulate compact gaps for next round
        gaps_file = rdir / "gaps.md"
        if gaps_file.exists():
            with put_review_fb(review_fb) as f:
                f.write(f"# Open gaps — after round {round_n} ({now()})\n\n")
                f.write(extract_compact_gaps(review_out))
        append_review_pointer(review_fb, review_out)

    # --- 3. CLAUDE RESCUE — last resort: claude implements the fixes itself ---
    log_rescue_start(ctx)
    rdir = ctx.tdir / "rescue"
    rdir.mkdir(parents=True, exist_ok=True)
    write_ticket_diff(ctx.workspace, base_ref, rdir / "ticket.diff")
    rescue_role = ctx.roster.role("rescue")
    rescue_chain = rescue_role.execute(ctx.workspace,
        {"ticket_file": ctx.ticket_file, "review_fb": review_fb,
         "base_ref": base_ref, "rounds": ctx.tunables.ticket_max_rounds},
        telemetry=ctx.telemetry,
    )
    if not rescue_chain.final.ok:
        log("[tool-failure] claude rescue unavailable — escalating")
        return 2
    ctx.workspace.commit(f"{ctx.name}: claude rescue implementation pass",
                         paths=allowed_commit_paths(ctx))
    verify_reviews(ctx.reviews_dir, ctx.tdir)

    # --- 4. RE-REVIEW after rescue ---
    rrdir = ctx.tdir / "rescue-review"
    rrdir.mkdir(parents=True, exist_ok=True)
    capture_run(ctx, rrdir)
    review_role.execute(ctx.workspace, {"ticket_file": ctx.ticket_file,
                                        "artifacts_dir": rrdir, "review_fb": review_fb,
                                        "base_ref": base_ref}, telemetry=ctx.telemetry)
    if not (rrdir / "review.md").exists():
        recover_review_files((rrdir / "review-attempt.txt").read_text(), rrdir)
    protect_review("rescue-review", rrdir, archive_dir=ctx.reviews_dir)
    if is_pass(rrdir / "review.md"):
        finalize_result = finalize(ctx, rrdir, rrdir / "review.md")
        if finalize_result == FinalizeResult.SUCCESS:
            return 0
        if finalize_result == FinalizeResult.COMMIT_FAILED:
            return 2
        # else: GAME_BROKEN — rescue passed review but the game still broken.
        # Bash falls through to split here; we do the same.

    # --- 5. SPLIT — carve the ticket into smaller, independently-solvable ones ---
    # Reached when:
    #   - rescue-review failed, OR
    #   - rescue-review passed but the game smoke confirmed broken
    # split() returns True iff claude produced a parseable carve and TASKS.md was updated.
    log_split_start(ctx)
    split_role = ctx.roster.role("split")
    if split(ctx, split_role):
        log(f"########## {ctx.name} SPLIT — smaller tickets queued ##########")
        return 3
    log(f"########## {ctx.name} could not be split — left open ##########")
    return 1
```

### 8.3 `backlog()` (replaces run_backlog.sh)

Handles the 4-way rc switch verbatim from `run_backlog.sh:30-47`:

```python
# harness/pipelines/backlog.py
def backlog(ctx: BacklogContext) -> int:
    """
    Walks open tickets in order, runs each, handles the rc switch.
    Returns 0 when no unchecked tickets remain, 2 on tool failure.
    """
    completed = 0
    while True:
        name = next_open_ticket()
        if name is None:
            log(f"=== backlog finished — {completed} ticket(s) completed ===")
            return 0
        rc = ticket(TicketContext(name=name, **ctx.shared))
        if rc == 0:
            completed += 1
            log(f">>> COMPLETE: {name}")
        elif rc == 2:
            log(f">>> HARNESS/TOOL FAILURE on: {name} — stopping backlog")
            log(f"=== summary: {completed} ticket(s) completed before the tool failure ===")
            return 2
        elif rc == 3:
            # Ticket was split into smaller ones; re-scan from the top.
            log(f">>> SPLIT: {name} restructured into smaller tickets — re-scanning")
            continue
        else:   # rc == 1 or unexpected
            log(f">>> INCOMPLETE: {name} — retrying; backlog will not advance past an unsolved ticket")
            time.sleep(30)
```

### 8.4 `supervisor` (replaces supervisor.sh)

```python
# harness/supervisor.py
class Supervisor:
    """Outermost watchdog; ports supervisor.sh including escalation-decay."""

    def __init__(self, *, max_escalations: int = 3):
        self.escalations = 0
        self.max_escalations = max_escalations
        self.roster: Roster | None = None    # set by run(); mutated by SIGHUP handler

    def _on_sighup(self, *_):
        """Triggered by SIGHUP. Replaces self.roster atomically; the
        loop reads self.roster fresh on each iteration so the next
        ticket sees the new roster. In-flight ticket()/subtask() calls
        keep their original roster reference (passed by argument)."""
        log("[supervisor] SIGHUP received — reloading roles.yaml + roles.local.yaml")
        try:
            self.roster = Roster.load("harness/roles.yaml", "harness/roles.local.yaml")
            log("[supervisor] roster reload OK")
        except Exception as e:
            # Don't crash the supervisor over a malformed YAML; keep the
            # old roster running and log loudly.
            log(f"[supervisor] roster reload FAILED — keeping current roster: {e}")

    def run(self) -> int:
        # Roster + tunables loaded ONCE here. SIGHUP triggers a reload via
        # self.roster reassignment in _on_sighup (NOT a walrus-in-lambda,
        # which silently fails to update the outer reference).
        self.roster = Roster.load("harness/roles.yaml", "harness/roles.local.yaml")
        progress_server.start_if_needed()
        # SIGHUP is Linux-only; this is fine for our target box. On macOS
        # this signal still exists; on Windows it does not — guard if we
        # ever cross-platform.
        signal.signal(signal.SIGHUP, self._on_sighup)

        while True:
            tags_before = count_v0_tags()
            log(">>> launching backlog run")
            # Read self.roster fresh on each loop iteration so a SIGHUP
            # between backlog runs is picked up immediately.
            rc = backlog(BacklogContext(roster=self.roster,
                                        tunables=self.roster.tunables, ...))
            tags_after = count_v0_tags()
            log(f">>> backlog run exited rc={rc} (completed tickets: {tags_before} -> {tags_after})")

            # Escalation-decay: each completed ticket pays back one strike.
            # Ported verbatim from supervisor.sh:38-44.
            completed = tags_after - tags_before
            if completed > 0 and self.escalations > 0:
                prev = self.escalations
                self.escalations = max(0, self.escalations - completed)
                log(f">>> {completed} ticket(s) completed — escalation strikes {prev} -> {self.escalations}")

            if rc == 0:
                log("######## supervisor: backlog complete — all tickets done ########")
                return 0
            if rc == 1:
                log("######## supervisor: some tickets genuinely incomplete — stopping for human review ########")
                return 1

            # rc == 2 (or unexpected): harness breakage — escalate to repair agent.
            self.escalations += 1
            if self.escalations > self.max_escalations:
                log(f"######## supervisor: {self.max_escalations} escalations exhausted — STOPPING ########")
                return 2
            log(f">>> ESCALATION {self.escalations}/{self.max_escalations}: asking claude to diagnose & repair")
            repair_pass(self.roster.role("repair"), suplog=Path("LOOPLOG.txt"))
            log(">>> diagnosis complete — restarting loop")
            time.sleep(5)
```

## 9. Telemetry, logging, and the progress server

### 9.1 Event stream

`telemetry/progress.py` exposes the same `emit_progress_event(type,
payload)` function as bash:
1. Append a JSON line to `harness/progress/events.ndjson`.
2. If `PROGRESS_SERVER_URL` is set, POST the line to `<URL>/events`.
3. Never affects control flow (errors swallowed).

Event vocabulary unchanged. Browser UI under `harness/progress/public/`
reads the same schema, no changes.

### 9.2 Usage telemetry

`telemetry/usage.py::record_agent_usage` writes a JSON line per agent
call. Schema includes `usage_kind` (from AgentInvocation; ports
`HARNESS_USAGE_KIND`) and `bucket` ("local" | "remote", from the Agent
instance; ports `agent_bucket_for_label`). The progress UI partitions
GPU-uptime telemetry by `bucket` — local calls count toward GPU-active
time, remote calls don't.

### 9.3 Progress server lifecycle

The browser UI's HTTP server (`harness/progress/server.mjs`) was launched
outside the bash harness today (separate tmux pane running `pnpm run
progress` or similar). v2 brings it into the supervisor:

```python
# harness/telemetry/progress_server.py
def start_if_needed() -> None:
    """Idempotent: if a server is already listening on PROGRESS_PORT, leave
    it alone; otherwise spawn `node harness/progress/server.mjs` as a
    child of this supervisor process. Lifecycle is tied to the supervisor
    (SIGTERM the supervisor → SIGTERM the progress server)."""

def stop() -> None: ...
def status() -> ServerStatus: ...
```

Subcommands: `python -m harness progress {start,stop,status}` for manual
use. Every subcommand that may emit events calls `start_if_needed()` at
boot — not just `supervisor`. That covers `backlog`, `ticket`, and
`subtask` invoked standalone (e.g. for debugging). `start_if_needed()`
is idempotent: it checks for a listening process on `PROGRESS_PORT`
before spawning, so concurrent subcommands don't fight over it.

The non-supervisor subcommands DO NOT stop the server on exit — only
the supervisor's SIGTERM cleanup does. This matches operator expectation:
a one-off `python -m harness ticket foo` shouldn't tear down a UI that
the operator's web browser is still attached to.

### 9.4 Logging

The bash harness uses `exec > >(tee -a "$SUBDIR/log.txt") 2>&1` so EVERY
stdout/stderr line from the orchestration AND its subprocesses lands in
`log.txt`. v1 only modeled agent stdout capture; v2 fixes this:

```python
# harness/telemetry/logging.py
@contextmanager
def tee_pipeline_log(path: Path):
    """Replace sys.stdout/sys.stderr with tees that write to BOTH the
    original handle and the path. Subprocess output is captured via the
    spawn() wrapper which streams to the same path; subprocess stderr is
    redirected to stdout for non-agent subprocesses. Restores on exit."""
```

`subtask()`, `ticket()`, `backlog()` each open one of these for their
respective log files. The result: `log.txt` per sub-ticket contains the
same content the bash version would have written.

## 10. Bash → Python file mapping

| Bash file / function                                            | Python module / function                                            |
| --------------------------------------------------------------- | ------------------------------------------------------------------- |
| `supervisor.sh`                                                 | `harness/supervisor.py` (`Supervisor`)                              |
| `run_backlog.sh`                                                | `harness/pipelines/backlog.py::backlog`                             |
| `run_ticket.sh`                                                 | `harness/pipelines/ticket.py::ticket`                               |
| `run_subtask.sh`                                                | `harness/pipelines/subtask.py::subtask`                             |
| `lib.sh::run_qwen` / `run_impl`                                 | `harness/agents/qwen.py::QwenAgent`                                 |
| `lib.sh::run_agent_model[_writable]`                            | `harness/agents/cursor.py::CursorAgent`                             |
| `lib.sh::run_agy`                                               | `harness/agents/agy.py::AgyAgent`                                   |
| `lib.sh::run_claude`                                            | `harness/agents/claude.py::ClaudeAgent`                             |
| `lib.sh::run_qwen_vision`                                       | `harness/agents/qwen.py::QwenVisionAgent`                           |
| `lib.sh::_run_cli` (retry/timeout/classify/usage_kind)          | `harness/agents/spawn.py::spawn`                                    |
| `lib.sh::cli_failure_reason` / `cli_output_is_only_error`       | `harness/agents/spawn.py::classify` (FailureReason enum)            |
| `lib.sh::has_verdict` / `is_pass`                               | `harness/prompts/acceptance.py::VerdictAccept`                      |
| `lib.sh::render_prompt`                                         | `harness/prompts/renderer.py`                                       |
| `lib.sh::commit_verified`                                       | `harness/git_helpers.py::commit_verified`                           |
| `lib.sh::start_game` / `stop_game` / `wait_for_game`            | `harness/steps/game.py`                                             |
| `lib.sh::port_in_use` / `wait_port_free`                        | `harness/steps/game.py`                                             |
| `lib.sh::write_qwen_vision_settings`                            | `harness/agents/qwen.py::QwenVisionAgent._write_settings`           |
| `lib.sh::qwen_extract_review_files` / `recover_review_files`    | `harness/steps/review.py::recover_review_files`                     |
| `lib.sh::emit_progress_event`                                   | `harness/telemetry/progress.py::emit_progress_event`                |
| `lib.sh::record_agent_usage`                                    | `harness/telemetry/usage.py::record_agent_usage`                    |
| `lib.sh::agent_bucket_for_label`                                | `Agent.bucket` field (read by usage.py)                             |
| `lib.sh::agent_model_for_label` / `review_agent_for_difficulty` | resolved by `Roster.role(name, difficulty=...)`                     |
| `lib.sh::filter_agent_feedback_noise`                           | `harness/prompts/noise_filter.py::filter_agent_feedback_noise`      |
| `lib.sh::revert_game_changes`                                   | `harness/steps/revert_game.py::revert_game_changes`                 |
| `lib.sh::confirm_game_broken`                                   | `harness/steps/confirm_broken.py::confirm_game_broken`              |
| `lib.sh::game_smoke_ok`                                         | `harness/steps/finalize.py::game_smoke_ok`                          |
| `lib.sh::next_version_tag`                                      | `harness/git_helpers.py::next_version_tag`                          |
| `run_ticket.sh::capture_run`                                    | `harness/steps/capture_run.py::capture_run`                         |
| `run_ticket.sh::coverage` block (L443-470)                      | `harness/steps/coverage.py::coverage_run`                           |
| `run_ticket.sh::protect_review`                                 | `harness/steps/protect_review.py::protect_review`                   |
| `run_ticket.sh::verify_reviews`                                 | `harness/steps/protect_review.py::verify_reviews`                   |
| `run_ticket.sh::append_review_pointer`                          | `harness/steps/append_review.py::append_review_pointer`             |
| `run_ticket.sh::put_review_fb`                                  | `harness/steps/append_review.py::put_review_fb`                     |
| `run_ticket.sh::ingest_nits`                                    | `harness/steps/ingest_nits.py::ingest_nits`                         |
| `run_ticket.sh::finalize`                                       | `harness/steps/finalize.py::finalize`                               |
| `run_ticket.sh::split_ticket`                                   | `harness/steps/split.py::split`                                     |
| `run_ticket.sh::rescue` block (L517-545)                        | `harness/steps/rescue.py::rescue`                                   |
| `run_subtask.sh::start_pipeline_checks` + `finish_pipeline_checks` | `harness/steps/pipeline_checks.py::background_vitest` + `finish_background_vitest` |
| `run_subtask.sh::ensure-handoff block (L129-145)`               | `harness/steps/handoff.py::ensure_handoff` (content-hash, not mtime) |
| `run_subtask.sh::optional vision feedback (L303-314)`           | `harness/steps/vision_feedback.py::optional_vision_feedback`        |
| `screenshot.mjs`                                                | unchanged — invoked as subprocess from `steps/screenshot.py`        |
| `harness/progress/server.mjs`                                   | unchanged — lifecycle managed by `telemetry/progress_server.py`     |
| `harness/progress/public/*`                                     | unchanged                                                           |
| `harness/githooks/*`                                            | unchanged                                                           |
| `harness/prompts/*.md`                                          | unchanged — read by the `prompts.renderer`                          |
| `harness/qwen_vision_smoke.sh`                                  | `harness/cli.py::doctor_vision` subcommand                          |
| `harness/lint.sh`                                               | **deleted at cutover** (shellcheck has nothing to target)           |
| `harness/tmp/runtime.env` (live-override file)                  | `harness/roles.local.yaml` (role + tunables; SIGHUP-reloaded)       |
| `IMPL_MODEL` / `QA_MODEL` / `DECOMP_MODEL` / `QWEN_DISABLED` env vars | gone — `roles.local.yaml` replaces them all                    |

¹ The gemini CLI was retired earlier this year (see `run_subtask.sh`
header comments) and the bash `Gemini quota fast-fail` block at
`lib.sh:758-770` no longer fires on any prod call. v2/v3 does not port
it. If a future agent needs mid-flight output-watch-and-kill, the
`OutputWatcher` parameter on `spawn()` is the extension point.

This is the parity contract for the cutover. The equivalence test in
phase 5 includes a check that every row above has corresponding test
coverage.

## 11. Tests

### 11.1 Unit tests (fast, run on every change)

| Module                          | What's tested                                                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `agents/spawn.py`               | Retry on EMPTY_OUTPUT / API_ERROR_ONLY_OUTPUT / QUOTA_OR_RATE_LIMIT / TIMEOUT (one test per failure pattern); hard timeout actually kills the subprocess within grace_kill_s+1; FailureReason classifier against fixtures from real stdouts captured in `tests/fixtures/cli_outputs/` |
| `agents/cursor.py`              | argv construction: writable=True → no `--mode`, writable=False → `--mode ask`; `--model` always present       |
| `agents/qwen.py`                | argv construction with/without model; openai_logging flag wiring; QwenVisionAgent settings-file generation    |
| `agents/agy.py`                 | **REGRESSION:** no `--model` flag ever appears in argv                                                        |
| `agents/claude.py`              | `--dangerously-skip-permissions` always present; model arg passed when set                                    |
| `roles.py`                      | Chain accepts on verdict + ok; chain accepts via ReviewAccept (review.md exists + has verdict); chain skips on tool failure; chain exhaustion path; `accepted_by` is None on exhaustion |
| `prompts/acceptance.py`         | `VerdictAccept` regex against real qa.txt fixtures (PASS, FAIL, neither); `ReviewAccept` accepts review.md-with-verdict, rejects no-review-file, runs recover_review_files when stdout has the chat-mode pattern (gpt R2 blocker fix); `OkRcAccept` returns True iff ok |
| `prompts/renderer.py`           | `__VAR__` substitution; absolute-path injection for `@file` references (the agy fix)                          |
| `prompts/noise_filter.py`       | Filters out "YOLO mode" / quota-retry lines; preserves real review content; idempotent                        |
| `git_helpers.py`                | `commit_verified` stages ONLY scoped paths; HEAD-advancement assertion (commit case AND nothing-staged case); `next_version_tag` increments correctly                                       |
| `git_helpers.scope_audit`       | clean diff in-scope → no-op; modified out-of-scope → reverted via git checkout; created out-of-scope (NEW untracked since baseline) → rm -f'd; deleted out-of-scope → restored; rename across scopes → both paths restored; deny pattern wins over allow pattern; **pre-existing untracked file is NOT considered agent-created** (v5 regression test for the baseline) |
| `workspace/repo.py`             | `repo.commit(paths)` does not `git add -A`; `repo.checkout(paths)` reverts only listed paths                  |
| `workspace/ports.py`            | Allocation returns fixed pair day 1; conflict detection works                                                 |
| `steps/handoff.py`              | `ensure_handoff` uses content hash, not mtime; synthesizes when hash unchanged; doesn't synthesize when hash differs |
| `steps/protect_review.py`       | `protect_review` chmods archive to a-w; `verify_reviews` restores tampered files from archive (the integrity case) |
| `steps/append_review.py`        | `put_review_fb` clears read-only bit before writing (the chmod dance fix)                                     |
| `steps/ingest_nits.py`          | TASKS.md edit appends under "Backlog — Housekeeping" heading when present; appends to end otherwise; handles CRLF, empty TASKS.md, ticket number sequencing |
| `steps/split.py`                | `===NEXT TICKET===` parser: zero chunks (no marker), one chunk, three chunks, chunk with no `#` header (slug generation fallback) |
| `steps/finalize.py`             | game_smoke_ok pass case; game_smoke_ok fail → confirm_game_broken called; tag + LOGBOOK + TASKS.md flip happen atomically; ingest_nits invoked when nits.md non-empty |
| `steps/pipeline_checks.py`      | background_vitest writes local-checks.status.json with rc + reason; finish_background_vitest joins the thread |
| `telemetry/progress.py`         | NDJSON append is line-atomic under concurrent writers; missing PROGRESS_SERVER_URL doesn't error               |
| `telemetry/usage.py`            | usage_kind and bucket fields land in the JSON line; backwards-compatible with the current server.mjs consumer schema |
| `config/loader.py`              | roles.local.yaml field-level merge (override + inherit + adding a new agent); schema_version mismatch errors clearly; reference to unknown agent name fails fast |

### 11.2 Integration tests (medium, run pre-PR)

| Scenario                                                                                  | What's exercised                                                         |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Single sub-ticket happy path with a stub agent that always passes                         | `subtask()` end-to-end                                                   |
| Sub-ticket where implementer crashes once then succeeds                                   | iteration retry + handoff synthesis                                      |
| Sub-ticket where primary QA fails, fallback QA succeeds                                   | `Role.execute` fallback chain                                            |
| Sub-ticket where all QA agents return no verdict                                          | tool-failure escalation (rc=2)                                           |
| Sub-ticket with SCOPE-CONFLICT sentinel in handoff.md                                     | `subtask` returns 3; `ticket` re-decomposes next round                   |
| Ticket where decomposer returns zero sub-tickets (atomic ticket)                          | `ticket()` no-decompose fallback                                         |
| Ticket round 1 fails review, round 2 passes review                                        | feedback accumulation + put_review_fb chmod                              |
| Ticket where 10 rounds fail → rescue passes                                               | rescue() + post-rescue review path                                       |
| Ticket where rescue fails → split succeeds                                                | split() + ===NEXT TICKET=== parsing + TASKS.md surgery                   |
| Ticket where rescue fails AND split fails                                                 | rc=1, ticket left open                                                   |
| Ticket where review passes but game_smoke_ok fails → confirm_game_broken clears the flake | finalize false-positive recovery                                         |
| Ticket where review passes and game stays broken after confirm                            | finalize returns False, next round runs                                  |
| Ticket completion with non-empty nits.md                                                  | ingest_nits creates the cleanup ticket; TASKS.md appended                |
| Reviewer prints file contents in chat instead of writing files (--mode ask trap)          | recover_review_files awk extractor recovers all three files              |
| Reviewer tampers with a protect_review'd archive file                                     | verify_reviews restores from archive on next round                       |
| Sub-ticket FAILED after MAX_ITER                                                          | revert_game_changes called; rc=1 from subtask                            |
| Backlog: ticket returns rc=3 (split) → backlog re-scans                                   | backlog 4-way switch                                                     |
| Supervisor: backlog returns rc=2, repair runs, restart succeeds                           | escalation-decay; SIGHUP roster reload                                   |
| Live-edit roles.local.yaml + SIGHUP                                                       | new roster takes effect at next supervisor cycle                         |
| Live-edit roles.local.yaml without SIGHUP                                                 | does NOT take effect mid-ticket (the one-boundary semantics)             |
| Implementer touches `harness/` despite ticket scope                                       | scope_audit() flags it; pipeline returns rc=2                            |
| Visual QA fails → vision_feedback enriches next iteration's prompt                        | optional_vision_feedback runs only on visual mode                        |

### 11.3 Equivalence test (the cutover gate)

The phase-5 cutover gate is a recorded-trace replay, not a live run.
Live runs differ on every execution because LLMs are non-deterministic;
v1's "diff should be identical for the deterministic-fallback path"
caught almost nothing. The fixture-replay approach:

1. **Record bash runs on recent main.** Augment `lib.sh::_run_cli` with
   a `--record` mode and run the bash harness against a fixed ticket set
   on the current `main` HEAD (NOT the rollback tag — recording on the
   tag means a patched bash on the frozen baseline, which risks timing
   and output drift from the production bash; recording on recent main
   means the recordings reflect actual production behavior). After
   recording, freeze the run as the equivalence baseline; the rollback
   tag and the baseline can be different commits.

   The recording captures, per CLI invocation:
   - `argv`, `prompt body`, `stdout`, `exit_code`, `wall_time`
   - **Filesystem diff after the call**: every file the agent created
     (full content), modified (full new content), or deleted (path only).
     Combines TWO git sources with a pre-call baseline, same shape as
     `scope_audit` per §7.4:
       (a) `git diff --name-status HEAD_before` — tracked changes
       (b) `snapshot_untracked()` taken BEFORE the call (recorded as
           `untracked_before`), then `snapshot_untracked()` after the
           call; new files = `post - untracked_before` (treated as
           adds). Same baseline-subtraction logic as §7.4 — without
           it, pre-existing stale untracked files would be recorded
           as per-call deltas every time.
     `(a)` alone misses the common case where an agent creates a new
     file without staging it — sub-ticket folders, written review
     files, split-output drafts. `(b)` captures those without
     duplicating pre-existing scratch files.
     File blobs go into `fixtures/bash_runs/<run-id>/<call-id>/fs/`.

   This is the change from v2 that gpt R2 flagged: stdout alone can't
   recreate game edits, decomposed sub-ticket files, written review
   files, rescue edits, or split files. Recording the filesystem delta
   means the replay can reproduce the same workspace state.

2. **Matching key.** Each recorded call is keyed by
   `(sub_ticket_label, iteration, role_name, call_order_within_iteration)`.
   `call_order_within_iteration` is a 0-indexed counter that
   distinguishes multiple calls of the same role-in-the-same-iteration
   (e.g. when a role retries within `spawn` — though those are usually
   coalesced by the recorder).

   For ticket-level calls (decompose, review, rescue, split) the key is
   `(None, round_n, role_name, call_order)`.

   The `MockAgent` family streams the fixtures in order, asserting that
   the actual key matches the next recorded key. A mismatch fails the
   test with a precise diff — the implementation diverged from the
   recorded flow.

3. **Replay against Python.** Each `MockAgent.run()` invocation:
   - Looks up the next matching fixture by key.
   - Returns the recorded `AgentResult(stdout=…, exit_code=…, …)`.
   - Applies the recorded filesystem delta to the workspace
     (writes blobs from `fs/`, removes deleted paths). This is what
     makes downstream operations (commit_verified, scope_audit,
     finalize) see the same state they saw under bash.

4. **Diff outputs.** The Python harness should produce:
   - identical events.ndjson (ignoring timestamps, run IDs, absolute paths)
   - **identical staged diffs from `commit_verified`** (NOT identical
     commit SHAs — SHAs depend on commit metadata timestamps, which
     replay can't reproduce without timestamp injection; staged diffs
     are the meaningful equivalence)
   - identical `.passed` marker placement
   - identical tag names created (next_version_tag is deterministic)
   - identical TASKS.md final state (line ordering, `[x]` checks)
   - identical nits-ticket directories created (file contents,
     not just paths)

5. **Fail the cutover if the diff is non-empty.** A small framework in
   `tests/integration/test_equivalence.py` runs this on every PR; CI
   gates the cutover branch on green.

**On recording maintenance.** The recordings are frozen at the moment
they're taken. If the bash harness keeps evolving during phase 1-4
(it shouldn't, but a critical fix might land), the recording is
re-taken from the latest main at that point. The phase-2-through-4
implementation should NOT chase a moving bash target; any divergence
from the recorded behavior should be a discussion ("did this bash
change actually intend X, or is X a bug we want to leave behind").

### 11.4 Smoke tests (slow, gated on real CLIs)

One smoke test per real backend, env-gated:
- `pytest -m smoke_qwen` — requires ollama + qwen3.6:27b-q8_0 loaded
- `pytest -m smoke_cursor` — requires `agent` CLI logged in
- `pytest -m smoke_agy` — requires antigravity CLI logged in
- `pytest -m smoke_claude` — requires `claude` CLI + auth

Each smoke test asserts **contracts**, not just "non-empty":
- QA prompt → output contains a `^VERDICT: PASS|FAIL` line (`has_verdict()` passes)
- implementer prompt → workspace `git diff` is non-empty after the call
- writable reviewer prompt → review.md / gaps.md / nits.md exist on disk
- read-only reviewer prompt → no diff in the workspace
- vision agent prompt → output references at least one screenshot file
- agy call → argv contains NO `--model` (regression for the agy quirk)

## 12. Migration plan

Phased, **not** big-bang. Five sized PRs land on `python-rewrite-cutover`
(skeleton, agents, roles, pipelines, cutover); the final cutover is one
revert-able commit on `main`. A sixth PR (delete `harness/*.sh`) lands
on main after the one-week observation window.

### Phase 0 — preparation

1. Decide the rollback tag. `37e0fae` (current HEAD) is a good candidate
   — last commit produced by the bash harness this session.
2. Cut `python-rewrite-cutover` from `main`.
3. Land **this design doc** on `main` (no code).
4. Cut a one-off patch on **recent main** (NOT the rollback tag — see
   §11.3 step 1) that adds `--record` mode to `lib.sh::_run_cli`, run
   the bash harness against 3 tickets of varied shape (one trivial PASS,
   one rescue, one split), commit recordings to
   `tests/fixtures/bash_runs/` on the cutover branch. The rollback tag
   and the recording commit can be different.

### Phase 1 — Python skeleton (PR #1, ~500 lines)

5. `poetry new harness`, `pyproject.toml` with `pydantic`, `pytest`.
6. Empty modules per §4 with class skeletons and `...` bodies.
7. `cli.py` subcommand router prints "not implemented" for everything.
8. CI green.

### Phase 2 — Agents (PR #2, ~1000 lines + tests)

9. `agents/spawn.py` + `FailureReason` classifier ported verbatim from
   `lib.sh::cli_failure_reason`. Unit tests for every failure pattern
   using fixtures from `tests/fixtures/cli_outputs/`.
10. `QwenAgent`, `CursorAgent`, `AgyAgent`, `ClaudeAgent`,
    `QwenVisionAgent` + per-agent unit tests on argv construction.
11. Smoke tests for each agent against the real CLI, env-gated.

**Note on test scope at this phase:** PR #2 only has unit + smoke
tests. Integration tests against `Role.execute` aren't possible until
Phase 3 lands. PR reviewers shouldn't reject PR #2 for missing
integration coverage; the integration suite arrives in PR #3 / #4 and
exercises agents as part of full role/pipeline tests.

### Phase 3 — Roles + Roster + acceptance + tunables (PR #3, ~500 lines + tests)

12. `roles.py`, `prompts/acceptance.py`, `prompts/renderer.py`,
    `prompts/noise_filter.py` + tests.
13. `config/schema.py` (Pydantic models for roles.yaml), `config/loader.py`
    with the field-level merge, `config/tunables.py`.
14. `roles.yaml` and `roles.local.yaml.example` checked in.
15. Integration test: `Role.execute` with stub-agent chains (~6 scenarios).

### Phase 4 — Workspace + steps + pipelines (PR #4, ~1500 lines + tests)

16. `workspace/repo.py`, `workspace/ports.py`.
17. `git_helpers.py` ported (`commit_verified`, `next_version_tag`,
    `scope_audit`, chmod helpers).
18. All `steps/*.py` ported. Each step has a unit test against a fake
    Context.
19. `pipelines/subtask.py::subtask` assembled. Integration tests against
    stub agents (single iteration, retry, fallback chain).
20. `pipelines/ticket.py::ticket` assembled. Integration tests:
    decompose → 2 subs → review → pass; rescue path; split path; finalize
    flake-recovery; nits ingestion.
21. `pipelines/backlog.py::backlog` + `Supervisor`. Integration tests:
    1-ticket backlog success; rc=2 → repair → restart; rc=3 → re-scan.
22. `telemetry/{progress,usage,logging,progress_server}.py` complete.
23. `cli.py` subcommand router fully wired; `python -m harness supervisor`
    is runnable end-to-end against stub agents.

### Phase 5 — Cutover (PR #5, the gate)

24. Equivalence-replay test runs on the cutover branch CI. Must be
    green.
25. Run Python supervisor against a real ticket end-to-end (smoke). Watch
    for behavior differences vs bash. Triage rule: a small functional
    difference (logging text, a non-load-bearing ordering) is a Python
    patch on the cutover branch. A load-bearing recovery-path divergence
    (rescue/split/finalize misbehaving against bash baseline) is a
    revert of the tmux-launch commit (PR #5) and a return to phase 4
    work; restart the observation window when the fix lands.
26. PR #5 makes ONE change: update the tmux launch command in operator
    docs from `bash supervisor.sh` to `python -m harness supervisor`.
    The bash files are NOT deleted in this PR.
27. Merge. Tag `v0-python-cutover`.
28. **One-week observation window.** Run Python in production. Keep the
    rollback tag handy. If anything breaks (especially the recovery
    paths — rescue, split, ingest_nits — that don't fire every ticket),
    one revert restores bash.
29. Only after the observation window is clean: PR #6 (~10 lines)
    deletes `harness/*.sh` and `harness/lint.sh`. This is the
    point-of-no-return commit.

### Phase 6 — Parallel workers (separate PR, separate week)

30. Add `workspace/worktree.py` (the second concrete class). Extract
    the Workspace ABC from the actual shared seams now that they exist.
31. `workspace/merge_queue.py` (asyncio.Lock + git merge logic).
32. Game-side: add `--server-port` / `--vite-port` flags to `node
    game/server/index.js` and the vite config.
33. `pipelines/ticket.py`: `for sub in subs` becomes a worker-pool
    submission. Backlog stays sequential per-ticket; only sub-tickets
    parallelize.
34. Smoke run with N=2 workers on a 4-sub-ticket fixture ticket.

## 13. Open questions

| #  | Question                                                                    | Status                                                                                                  |
| -- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Q1 | Python version                                                              | 3.12. Confirmed on the box. Uses stdlib only (no anyio).                                                |
| Q2 | Async or sync?                                                              | Sync day 1. Async in phase 6 only where workers benefit. (Both reviewers correctly flagged async on day 1 as no-rent.) |
| Q3 | Single-process or per-pipeline subprocess?                                  | **Per-sub-ticket subprocess** (`python -m harness subtask <dir>` spawned by `ticket()`). Hard requirement for day 1: same isolation as bash; cheap context teardown. Phase 6 may move to single-process with the worker pool. |
| Q4 | Anchor merging across YAML files                                            | Resolved: named `agents:` mapping (§6.3), no anchors needed. Local file can add new agents to the map.   |
| Q5 | Repair-agent's broad write scope                                            | `scope_audit()` runs after every writable role's execute (not just implementer). Out-of-scope edits get reverted and the role's result is downgraded to TOOL_FAILURE. |
| Q6 | Process-management strategy under tmux                                      | Keep tmux as the session manager. Supervisor installs a SIGTERM handler that drains active pipelines (kills child subtask subprocesses) before exiting. |
| Q7 | Pre-commit hooks (`harness/githooks/`)                                      | Unchanged.                                                                                              |
| Q8 | Backwards compatibility with `tickets/**/` layout                           | Confirmed in §2 non-goals: zero changes.                                                                |
| Q9 | Runtime.env replacement                                                     | Resolved: `roles.local.yaml` carries role overrides; tunables section at the top of roles.yaml /roles.local.yaml carries non-role config (`MAX_ITER`, `*_TIMEOUT`, `GAME_URL`, …). |

### New open questions raised by review

| #   | Question                                                                                              | Disposition                                                                                                       |
| --- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Q10 | What happens if a phase-5 cutover hits an issue we don't catch until day 6 of the observation window? | One `git revert` of the tmux-launch commit. Bash files still on disk. Observation window exists for this reason. |
| Q11 | SCOPE-CONFLICT sentinel: what marker, what level?                                                     | Marker: a magic comment in `handoff.md`: `<!-- HARNESS:SCOPE-CONFLICT -->` followed by a paragraph of why. Level: sub-ticket exits 3; ticket loop catches and re-decomposes next round. Prompt change to the implementer template ships in a separate PR after the rewrite. |
| Q12 | Schema versioning                                                                                     | `schema_version: 1` required in roles.yaml (§6.3). Loader raises if missing or > 1. Migration path will be documented when v2 ships. |
| Q13 | Roles.local.yaml ergonomics for adding a role that doesn't exist in roles.yaml                        | Loader supports it — `roles.local.yaml` can declare new role names. Useful for one-off experiment roles.          |
| Q14 | What if the progress server crashes mid-run?                                                          | `start_if_needed()` is called at every supervisor boot. Mid-run crash: events.ndjson keeps accumulating; the UI reconnect on next page-load picks up. Optional: a watchdog thread that restarts the server on crash; punt to phase 6.5. |
| Q15 | How does the SIGHUP roster reload interact with in-flight sub-tickets?                                | Reload sets `self.roster` in the Supervisor (NOT a local rebind — see §8.4 for the bug fix). In-flight `ticket()` and `subtask()` calls hold their original roster reference (passed as a function argument) and finish on the old config. Only the NEXT ticket sees the new roster. |
| Q16 | When does per-difficulty fallback override make sense?                                                | When the primary's whole reason for selection is that the simpler model couldn't handle it — e.g. `gpt-5.5-extra-high` was picked for `hard` because composer-2.5 failed; falling back to composer-2.5 defeats the point. The hard tier defaults to `[claude]` only; easy/medium use the shared `fallbacks: [composer_write, claude]`. |
| Q17 | What's the recording-vs-rollback divergence risk?                                                     | Recording is on recent main with a `--record`-augmented bash; rollback tag is whatever stable state we want to revert to. They can be different commits. The risk is that bash behavior between rollback-tag and recording-commit is meaningfully different — mitigation: when recording, also re-validate that the rollback tag still runs the same ticket set with the same outcomes (one-time pre-recording check). |
| Q18 | How does the progress server lifecycle work for non-supervisor subcommands?                           | Every event-emitting subcommand calls `start_if_needed()`; idempotent (no double-spawn). Non-supervisor subcommands do NOT stop the server on exit; only the supervisor's SIGTERM teardown does. See §9.3. |

## 14. Risks

| Risk                                                                          | Mitigation                                                                                                                                                                 |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cutover regression — Python misses a subtle bash behavior                     | Equivalence-replay test (§11.3) catches deterministic divergences. One-week observation window (§12 step 28) catches non-deterministic ones. Rollback is one revert.        |
| `_run_cli`'s retry classifier has hard-won regex tweaks we drop               | Port the regex list verbatim into `agents/spawn.py::classify` with a unit-test fixture for each pattern (the lib.sh source is the source of truth).                        |
| Roles YAML schema drift between this doc and the implementation               | Pydantic models in `config/schema.py` are the source of truth; a small `tools/dump-roles-schema.py` script in phase 1 dumps the schema as YAML and asserts it matches the §6.3 example. |
| Phased PRs are still too large to review                                      | Phase 4 is the biggest at ~1500 lines + tests. If it bloats further, split into 4a (workspace+git_helpers+steps) and 4b (pipelines+supervisor+telemetry).                   |
| Subprocess semantics differ from bash's `timeout -k 30`                       | `spawn` uses Popen + timer-thread that SIGTERMs at timeout_s and SIGKILLs at timeout_s + grace_kill_s. Unit test verifies a hung subprocess is actually killed within grace+1 seconds. |
| Repair-agent's broad write scope                                              | `scope_audit()` reverts out-of-scope edits and downgrades to TOOL_FAILURE (Q5). The repair role's scope allows `harness/**`; everything else is blocked.                   |
| Worktree-per-worker breaks the game's hard-coded ports                        | Documented as a phase-6 prerequisite (small game-side change). Day 1 / phase 5 do NOT require this.                                                                        |
| Recorded-fixture replay test gets stale as the bash harness keeps evolving    | Rollback tag is frozen at `37e0fae`. Re-record only if a substantive bash change happens during phase 1-4 — that's a yellow flag because phase 1-4 should be quick.        |
| SIGHUP reload races with the supervisor's `signal.signal(...)` setup          | The supervisor sets the handler before its main `while True:` loop starts. The race window is one line of code. Tested by an integration test that SIGHUPs during boot.    |

## 15. What this design buys us, restated

- **Today's role experiments are one YAML edit.** The IMPL_MODEL /
  QA_MODEL / DECOMP_MODEL / QWEN_DISABLED conversation we had earlier
  becomes: "edit `roles.local.yaml`; SIGHUP the supervisor." No new bash
  knob per role per experiment.
- **Adding a new backend is one Python class plus its config dataclass.**
  When cursor adds composer-3 or a new vendor's CLI shows up, it's one
  `Agent` subclass + one YAML row to add it to the roster, with zero
  changes to the dispatch logic.
- **The QA-chain ladder stops being a regex of `elif`s in shell.** It's
  a list, in YAML, that anyone can read. Same for the rescue and split
  fallbacks.
- **The recovery and finalization machinery is no longer scattered.**
  Today's `rescue` / `split` / `finalize` / `ingest_nits` / `protect_review`
  / `verify_reviews` / `confirm_game_broken` are 200+ lines spread across
  `run_ticket.sh` and `lib.sh`. v2 puts each one in its own module with
  unit tests.
- **Parallel workers become a scheduling change, not an orchestration
  rewrite.** Phase 6 adds `WorktreeWorkspace` and the merge queue and
  flips `for sub in subs` to a worker-pool submission. The pipeline
  functions themselves don't change.
- **Tests.** Stub agents + the fixture-replay equivalence gate exercise
  the recovery paths (rescue, split, ingest_nits) that don't fire on
  every ticket, in milliseconds. The bash harness had none of this.
