# Claude review of python-rewrite.md — round 1

## 1. ARCHITECTURE SOUNDNESS

The four-layer split is sound in concept but the boundary between Pipeline and Role leaks in two places.

First, §8.3's `SubTicketPipeline` references `role_name_fn=ctx_qa_mode` and `OptionalVisionFeedbackStep(...)` — both branch on data that lives in the ticket front matter (`QA_MODE`, `QWEN_VISION_FEEDBACK`). The Pipeline is supposed to be static "code-as-data" but it pulls in role selection at runtime. That's fine in practice, but it means the Roster isn't actually decoupled from the Pipeline — the Pipeline has to know which role names exist (`qa:code`, `qa:visual`) and the YAML must keep using exactly those names. The §6 wording "Roles change frequently / Pipelines change rarely" hides this coupling.

Second, the Workspace ABC (§7) leaks a path-scope concept (`PathScope`) that's really a Role concern. `scope: { allow: ["game/**"], deny: ["tickets/**"] }` in §6.1 is a per-role contract; making `Workspace.diff(scope)` and `commit(scope)` accept it forces the workspace to encode role policy. Better: keep scope on the Role and have a `ScopeAuditStep` that calls a plain `workspace.diff()`.

The Orchestrator → Pipeline → Role → Agent direction holds. RetryStep at the iteration level (§8.2) vs `_spawn`'s per-call retries vs `Role`'s per-tier fallback gives three layers of retry, which is what the bash does today — call this out explicitly so future maintainers don't collapse them.

## 2. INTERFACE COHERENCE

The `Agent.run()` signature (§5) is missing two things the bash actually does today:

1. The bash `_run_cli` (lib.sh:731-805) sets `HARNESS_USAGE_KIND` as an env var so `record_agent_usage` (lib.sh:419) can bucket the call (`implementer`, `final_review`). The Python `AgentResult` carries `extra: Mapping[str, str]` but the design doesn't show how usage-kind flows from caller to telemetry. Two callers (`run_agent_model_writable`, `run_impl` at lib.sh:932, 944) explicitly set this — the Python design doesn't.
2. `ChainResult.skipped: list[tuple[Agent, str]]` (§6) carries a reason string but the design doesn't enumerate the reason vocabulary. The bash distinguishes `empty_output`, `quota_or_rate_limit`, `api_error_only_output`, `timeout`, `killed_after_timeout`, `terminated_by_signal`, `exit_<rc>` (lib.sh:297-314). These need to be an Enum, not a string — `_spawn.py` and the telemetry consumer both depend on the exact vocabulary, and stringly-typed will drift.

The Role interface assumes verdict-or-no-verdict is the accept criterion. For the review role it has to add `accept_on: [REVIEW_FILES_WRITTEN]` (§6.1) — that's a different shape of acceptance ("a side-effect happened on disk"). Either generalise `VerdictParser` to "AcceptanceParser" or recognise the two shapes are distinct and give them distinct types.

`AgentResult.diff` (§5, line 238) is *the agent's* diff against workspace state at `.run()` entry. For `cursor-agent --mode ask` (read-only) this is always empty; for the writable variant it's the post-edit diff. Computing this inside `_spawn.py` requires snapshotting before and `git diff` after — for every agent call. That's a real cost; either say it's lazy (computed on access) or move it out of `AgentResult`.

## 3. MIGRATION RISK

Big-bang in one PR is risky and §12 admits it (the "Phase 1-4 land as separate PRs on the cutover branch" mitigation in Risk #4 is the realistic plan, and it contradicts the "big-bang" framing at the top of the doc — pick one).

The equivalence-diff test at step 22 is not meaningful as described. The doc says "events.ndjson should differ only in timestamps; commit messages and code diffs should be identical for the deterministic-fallback path (implementer outputs will differ because the LLM is non-deterministic; this is expected)." If the implementer output differs, the diff differs, the QA prompt differs, the QA verdict can differ, the number of iterations can differ, the events.ndjson differs in structure, not just timestamps. The "deterministic-fallback path" only fires when qwen leaves changes uncommitted — that is the exception, not the rule. The proposed test catches almost nothing.

A more meaningful equivalence check: replay a recorded prompt+response trace (record one bash run with mocked agents that return fixed outputs, then re-run the Python harness against the same mocked responses and diff events.ndjson). This is straightforward and actually decisive.

Phase boundaries: phase 2 (agents) before phase 3 (roles+roster) before phase 4 (workspace+pipelines) is correct. But Phase 5 conflates "switch tmux to python -m harness" with "delete harness/*.sh"; those should be two steps with a week between them so the bash can be re-enabled by reverting one commit if something doesn't catch fire until day 3.

## 4. WHAT IS MISSING

§10's bash→python table is missing a lot of `run_ticket.sh` machinery:

- **Rescue pass** (run_ticket.sh:517-545). Claude implementing the fixes when all `TICKET_MAX_ROUNDS` are exhausted. Not in §8.4's `TicketPipeline`, not in §10 mapping. This is a load-bearing recovery step.
- **Ticket split** (run_ticket.sh:289-358, `split_ticket()`). Claude carving an unsolved ticket into smaller ones, with the `===NEXT TICKET===` parser, TASKS.md surgery, and the `exit 3` → `run_backlog.sh:40-42` handler. Backlog has a four-way switch (rc 0/2/3/*) and the design only models rc 0/1/2. Without rc=3, splits become tool failures.
- **`finalize()`** (run_ticket.sh:261-286): includes `game_smoke_ok`, `confirm_game_broken` (a *second* capture run when the first looks broken), tag allocation via `next_version_tag`, LOGBOOK.md append, TASKS.md `[ ]` → `[x]` flip, and `ingest_nits` to file a follow-up cleanup ticket. None of these appear in §8.4.
- **`protect_review()` + `verify_reviews()`** (run_ticket.sh:180-209). Reviews are `chmod a-w`'d and an integrity check restores any tampered file from the archive. Mentioned only as `VerifyReviewsStep` in §10 line 947 with no detail; the chmod and restore-from-archive behaviour is missing.
- **`capture_run()`** vs the inline screenshot path in `run_subtask.sh`. The TicketPipeline runs `capture_run` before review (`run_ticket.sh:479`); §8.4 doesn't show it.
- **`coverage` pass** (run_ticket.sh:443-470). `vitest --coverage --changed BASE_REF` before top-level review, with thresholds disabled. Visibility-only, but it writes `coverage.log` into the review artifacts dir that the reviewer prompt references.
- **`revert_game_changes()`** (lib.sh:1168-1171). Called on sub-ticket failure after MAX_ITER (run_subtask.sh:333). Not mapped.
- **`append_review_pointer()` / `put_review_fb()`** (run_ticket.sh:213-225). The chmod-then-write dance on REVIEW_FB is a real bug-fix (cp from a read-only protect_review'd file would create REVIEW_FB at mode 444); the design needs to model "feedback file must stay writable across rounds".
- **`filter_agent_feedback_noise`** (lib.sh:356-380). Wraps the QA output before it's appended to feedback.md so the next iteration's prompt isn't polluted with "YOLO mode is enabled" / quota-retry chatter. Not in §10.
- **`agent_bucket_for_label` / `agent_model_for_label`** (lib.sh:382-401). The "local vs remote" bucket label is consumed by the progress UI. §10 line 948 dismisses it as "resolved by `Roster.load()` — no equivalent needed" — but the *bucket* (local/remote) is a separate concern from the *model name*, and the UI shows GPU-uptime telemetry partitioned by it.
- **Gemini quota fast-fail** (lib.sh:758-770). Polling the output mid-run for a quota-exhaustion line and killing the process at 12s. The §5.2 `_spawn` description mentions retrying on "you have exhausted your capacity" sentinel but not the *mid-flight* watch-and-kill behavior. Probably can be deleted (gemini CLI is retired per `run_subtask.sh` comments) but the design should say so.
- **`PIPELINE_LOCAL_CHECKS` background vitest** with split server/client timeouts (run_subtask.sh:44-107). §8.3 has `PipelineChecksStep` in a `ParallelStep` but doesn't model the start-in-background / collect-status-later pattern, or the `local-checks.status.json` artifact the progress UI consumes.

That's roughly a third of `run_ticket.sh`'s real behavior not represented anywhere in the Python design.

The `runtime.env` source pattern at lib.sh:99-102 also implies that hot-reload can change `MAX_ITER`, `TICKET_MAX_ROUNDS`, `*_TIMEOUT` — not just role assignments. The §6.3 hot-reload story only covers role swaps.

## 5. WHAT IS OVERBUILT

**Workspace ABC is overbuilt on day 1.** §7.1 (RepoWorkspace) and §7.2 (WorktreeWorkspace) share no real implementation; the ABC exists entirely for the day-1 single-worker version to satisfy a future contract. Better: one concrete `Repo` class today. When the merge-queue work starts in phase 6, extract the ABC then — you'll know what the real seams are after writing `WorktreeWorkspace` for real, not before. `merge_into_main()` returning `MergeResult(no_op=True)` is a smell.

**`Capability` Flag enum (§5).** `READ_FILES` is "always true for our agents" per the comment at line 215. `LONG_CONTEXT` is informational; nothing in the design dispatches on it. `VISION` is checked nowhere — the vision agent is selected by role name (`vision_feedback`). Drop the enum; the only capability that actually matters is "can write," which is already an explicit `writable: bool` field on `CursorAgent`.

**`cost_tier` on Agent (§5).** Not consumed by anything in the design. Either show the consumer (a cost-aware fallback chain?) or drop it.

**`SequenceStep`/`ParallelStep`/`BranchStep`/`IterateStep`/`RetryStep`/`WhileStep`/`BreakStep`/`ForEachSubTicketStep`/`NoOpStep`** (§8). This is reimplementing a workflow engine. The bash composition is just sequential code with `if`/`for`. A flat Python function per pipeline reads more clearly than a tree of combinators and lets you set breakpoints in normal places. Combinators are worth their weight when pipelines are themselves data (loaded from YAML, edited by users). They're not here — §3.3 says explicitly that pipelines are code, not data. Use functions.

**Three review roles (`review:easy`, `review:medium`, `review:hard`).** They differ only in `primary`. In YAML, one parameterised role would be cleaner: `review: { primary_by_difficulty: { easy: ..., medium: ..., hard: ... }, fallbacks: [...] }`.

## 6. YAML / CONFIG ERGONOMICS

YAML anchors are the wrong mechanism. The `_agents:` block in §6.1 is a YAML list of anchored objects whose only purpose is to be referenced — that's an abuse of list semantics that confuses every reader who hasn't seen it before. Use a top-level mapping:

```yaml
agents:
  qwen: { backend: qwen }
  composer_fast_write: { backend: cursor, model: composer-2.5-fast, writable: true }
roles:
  implementer:
    primary: qwen          # by name, not anchor
    fallbacks: [composer_fast_write]
```

Pydantic resolves names at load time. This also fixes Open Question #4 (anchor merging across files): named references compose trivially.

20 roles is fine; the limiting factor is the per-role boilerplate. Six fields per role × 20 = 120 lines, but most fields are stable per role-family (QA roles all share `verdict_parser`, `scope`, `out_file`). Introduce role base-classes (mappings under a `_role_defaults:` key) and roles override only what differs.

**Hot-reload semantics (§6.3) will bite.** "Reloads on next Pipeline construction" means: change YAML mid-`run_ticket.sh`, and the change takes effect on the *next sub-ticket* of the *same ticket*. So a `TICKET_MAX_ROUNDS` edit could activate mid-ticket and leave the operator unsure whether the new value is being honoured for the current round. Either reload only on top-level invocation (clearer) or reload on every step entry (more responsive). The middle ground proposed is the worst of both.

Also: `roles.local.yaml` is a *full role replacement* per §6.1 description. That means re-declaring the implementer to change just its primary forces you to copy `timeout_s`, `out_file`, `prompt_template`, `verdict_parser`, `scope` verbatim. Real ergonomic UX is field-level merge for `roles.local.yaml`, even if it's "confusing semantics" — the operator wants to type one field, not seven.

## 7. TEST PLAN COVERAGE

Strong on unit tests, weak on integration. Missing:

- **No round-trip fixture** for the equivalence diff (§12 step 22). Without recorded fixtures, the test isn't repeatable.
- **No test for `ingest_nits` TASKS.md mutation.** A regex-based markdown edit is exactly the kind of thing that breaks on edge cases (no `## Backlog — Housekeeping` heading, duplicate ticket names, CRLF).
- **No test for `split_ticket`'s `===NEXT TICKET===` parsing.** awk fragility is well-attested; the chunking and slug generation need fixtures (zero chunks, one chunk, three chunks, chunk with no `#` header).
- **No test for `protect_review` chmod + integrity-check restore.** A test that writes a review, chmods it, has a stub-agent try to overwrite it, runs verify, asserts the original is restored.
- **No test for `commit_verified` HEAD-advancement assertion** under the case where nothing was staged (return 0) vs commit happened (return 0 + HEAD changed).
- **No contract test for the events.ndjson schema.** The browser consumes a specific shape per event type; the design says "browser unchanged" but doesn't have a test asserting the new emitter produces the same JSON keys per event.
- **Smoke tests (§11.3)** are too loose: "assert the agent produced a non-empty output" misses the cases the harness actually fails on (empty output, api-error-only output, no-verdict). At minimum, assert that the agent's output passes `has_verdict()` for the QA prompt and produces a diff for the implementer prompt.

## 8. OPEN QUESTIONS THE DOC DIDN'T ASK

1. **What's the rc=3 (ticket split) story?** Backlog handles rc 0/2/3/* differently (run_backlog.sh:30-47). §8.5 `BacklogPipeline` only branches on `ticket_outcome == "complete"`. Split tickets vanish in the Python model.

2. **How does the SCOPE-CONFLICT sentinel land?** Per user memory, this is the planned exit 3 from sub-tickets when ACs are unfixable in scope, routed to the next-round decomposer. The design has `scope:` rules on roles and a `GuardImplementerScopeStep` that "flags" out-of-scope edits but doesn't say what "flag" means in terms of rc / control flow. This needs to be designed before it's deployed.

3. **What happens to `tmp/runtime.env`'s non-role overrides (`MAX_ITER`, `TICKET_MAX_ROUNDS`, `*_TIMEOUT`, `QWEN_VISION_FEEDBACK`, `PIPELINE_*`)?** §10 says runtime.env → roles.local.yaml; §15 says "no new bash knob per role per experiment." Neither addresses the non-role knobs. Where do they go — roles.yaml top-level, a separate config.yaml, or environment?

4. **Subprocess isolation vs in-process pipelines (Open Q3).** The doc recommends per-sub-ticket subprocess for day 1. That means roles.yaml is re-read per sub-ticket, which is fine, but it also means async (`asyncio.create_subprocess_exec`, `pytest-anyio`) gives you nothing — there's only one concurrent thing happening. Async is justified by the *future* parallel-workers case. So: drop async for day 1, add it in phase 6 where it pays for itself. The interface impact is small if you commit to async-style today, but the cognitive cost is real.

5. **What runs the `progress/server.mjs` Node process?** It's an HTTP server the browser UI talks to. The bash harness launches it via `pnpm run progress` (separate tmux pane, I assume). Python design treats it as "unchanged" (§9) but doesn't say who starts/stops it. Cutover step 23 deletes the bash; if a bash file was responsible for spawning the progress server, that responsibility moves where?

6. **Logging vs telemetry.** Today every sub-ticket has `log.txt` (tee from bash). Python design has `telemetry/logging.py` "tee to per-pipeline log files." The bash also uses `exec > >(tee -a "$SUBDIR/log.txt") 2>&1` so *every* subprocess stdout/stderr lands in log.txt. In Python, only the agent stdout is captured to AgentResult — the rest of the orchestration logs need explicit handling.

7. **Where does the post-cutover bash linter (`harness/lint.sh`) live once all `*.sh` are deleted?** §4 lists `cli.py::lint` wrapping shellcheck "for as long as any bash exists in the tree." That'll be zero seconds after cutover. The subcommand is dead on arrival.

8. **What's the contract for `EnsureHandoffStep` when the implementer DID write a handoff?** The bash compares `stat -c %Y` before/after (run_subtask.sh:133, 140). On a fast machine the mtime can be identical down to the second granularity. Python should compare content hash or use ns precision.

9. **Will the `_agents` YAML schema be versioned?** A `schema_version: 1` field on roles.yaml costs nothing now and gives you migration room when (not if) the roster format evolves.
