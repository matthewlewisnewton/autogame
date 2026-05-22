## ARCHITECTURE SOUNDNESS
The four-layer split in §3.1 is directionally good: Agent/Role/Pipeline/Orchestrator matches the real “CLI wrapper / fallback ladder / subtask loop / backlog loop” shape. The leak is Workspace. §7 puts git commit/tag/merge directly on `Workspace` (`python-rewrite.md` lines 664-681), which makes Workspace both filesystem root and release-control boundary. That will buckle when ticket-level operations need baseline refs, review archives, splits, and nits tickets, none of which are just “workspace operations.”

The Pipeline abstraction also underplays ticket-level control flow. §8.4 models decompose → subtasks → review → approve/fail (`python-rewrite.md` lines 803-831), but current `run_ticket.sh` has finalize smoke confirmation, review archive protection, nit-ticket ingestion, rescue, and split. Those are not optional edge features; they are core liveness and safety behavior.

## INTERFACE COHERENCE
`Agent.run()` is too thin for the real backend differences. `AgentSpec` only has `backend`, `model`, `writable`, and `extra` (`python-rewrite.md` lines 251-262), but current bash has meaningful per-agent knobs: qwen OpenAI logging, qwen vision base URL/API key/settings file, agy `--print-timeout`, Claude model, retry budgets, quota fast-fail, and usage kind. Shoving all of that into `extra` makes the typed interface mostly cosmetic.

`Role.execute()` accepts a tier if `AgentResult.ok` and a verdict exists (`python-rewrite.md` lines 462-469). That matches QA, but not review recovery. Top-level review acceptance is “files exist after writable reviewer or recovery,” not stdout verdict. The doc gestures at `accept_on: [REVIEW_FILES_WRITTEN]` (`python-rewrite.md` lines 565, 574, 583), but the Role interface has only stdout plus a generic verdict parser.

Workspace commit scope is also underspecified. Current `commit_verified` has special handling for harness-scoped tickets and excludes `harness/` by default while allowing broader root edits (`lib.sh` lines 1115-1156). §7 only offers `commit(message, scope)`; the design needs to explicitly model “operator harness state must not be swept into game commits.”

## MIGRATION RISK
The big-bang cutover is not realistic as written. §12 says delete `harness/*.sh` after one equivalence run (`python-rewrite.md` lines 1070-1082). One ticket will not exercise rescue, split, nits, review recovery, failed smoke confirmation, harness-scoped commits, qwen-disabled chains, or runtime overrides.

The equivalence diff in step 22 is weak. The doc admits implementer outputs differ due to nondeterminism (`python-rewrite.md` lines 1076-1079), which means code diff, review text, events, and commit messages can all diverge. The meaningful equivalence test is not “same final diff”; it is a scenario matrix with stub agents plus a few real CLI smoke tests.

Phase boundaries are mostly right bottom-up, but Phase 4 is too large (`python-rewrite.md` lines 1054-1068). Ticket finalization, rescue/split, and review immutability should be separate migration gates before cutover.

## WHAT IS MISSING
The largest omissions are from `run_ticket.sh`, not `run_subtask.sh`.

Current bash has immutable review archival and restoration (`run_ticket.sh` lines 178-209). §8.4 mentions `RecoverReviewFilesStep`, but not `ProtectReviewStep` or `VerifyReviewsStep` in the pipeline, despite §10 mapping `verify_reviews` (`python-rewrite.md` line 947).

Finalize smoke protection is missing from §8.4. Bash refuses to complete a ticket if review passes but two smoke captures show the game is broken (`run_ticket.sh` lines 259-286). The design jumps from review approve to tag/complete (`python-rewrite.md` lines 819-825).

Nits ingestion is missing. Bash files non-blocking reviewer nits as a new backlog ticket and edits `TASKS.md` (`run_ticket.sh` lines 227-257). No pipeline step or §10 mapping covers this.

Rescue and split are missing from the main design. Bash has Claude rescue after exhausted rounds (`run_ticket.sh` lines 517-545) and ticket splitting (`run_ticket.sh` lines 547-556). §8.4 stops at `TICKET_MAX_ROUNDS`; §10’s `run_ticket.sh` mapping line only says “decompose / sub dispatch / review” (`python-rewrite.md` line 951).

`filter_agent_feedback_noise` is not mapped in §10, yet feedback accumulation uses it (`run_subtask.sh` lines 319-328). Without it, quota/tool noise pollutes future prompts.

Runtime config is misrepresented. §10 says `harness/tmp/runtime.env` becomes `roles.local.yaml` (`python-rewrite.md` line 959), but `runtime.env` currently controls non-role tunables like `MAX_ITER`, `GAME_URL`, pipeline checks, coverage, qwen vision, and timeouts (`lib.sh` lines 17-88). YAML role config does not replace that.

## WHAT IS OVERBUILT
`Workspace` as an ABC on day 1 is premature. §7.1 says day 1 is always the main repo (`python-rewrite.md` lines 685-689), while worktrees only arrive in Phase 6 (`python-rewrite.md` lines 1084-1091). Start with one concrete `RepoWorkspace` and keep call sites narrow: `root`, git helper functions, and ports. Add the interface when `WorktreeWorkspace` exists.

`Step` combinators are also close to overbuilt. `ParallelStep`, `BranchStep`, `RetryStep`, and mutable `state: dict[str, object]` (`python-rewrite.md` lines 721-754) risk recreating an untyped shell script in Python. For day 1, named Python functions with explicit return types may be easier to test and review.

## YAML / CONFIG ERGONOMICS
The anchors in §6.1 are fine for 10 roles, but brittle at 20+. YAML anchors do not compose cleanly across `roles.yaml` and `roles.local.yaml`, and the doc already acknowledges that in §13 (`python-rewrite.md` lines 1109-1114). A named `agents:` map would scale better than list anchors:

`agents.composer_fast_read`, `agents.qwen_default`, etc., then roles refer to names.

Hot reload is underspecified. §6.3 reloads per pipeline (`python-rewrite.md` lines 636-647), but ticket-level roles load once at ticket start. That means changing review/decomposer config mid-ticket does not apply until the next ticket, unlike the current `runtime.env` behavior where each subprocess re-sources config.

## TEST PLAN COVERAGE
§11 is a good start, especially stub-agent integration tests (`python-rewrite.md` lines 988-1003). It does not cover the riskiest ticket behaviors: review archive immutability, nits ticket creation, finalize smoke failure, rescue success, split success/failure, failed subtask rollback, harness-scoped ticket commits, and coverage artifact copying.

The smoke tests only assert “non-empty output” (`python-rewrite.md` lines 1013-1015). That is too weak. They should assert argv compatibility plus the expected contract: verdict line for QA, file writes for writable review, no writes for read-only QA, qwen vision settings honored.

## OPEN QUESTIONS THE DOC DIDN'T ASK
What is the authoritative config model for non-role tunables after `runtime.env` disappears?

What is the rollback story for partial Python ticket runs that have already committed subtasks?

Should day-1 Python preserve subprocess isolation per sub-ticket as a hard requirement, not just a recommendation in §13 (`python-rewrite.md` lines 1102-1108)?

What invariants must hold before tagging: clean smoke, review archive intact, nits ingested, `TASKS.md` updated, commit made, tag created? The design needs that as an explicit finalization contract.
