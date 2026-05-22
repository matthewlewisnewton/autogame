## SPEC-VS-CODE DRIFT
- `spawn()` ignores YAML tunables for retries/backoff. Spec says `tunables.cli_retries` / `cli_retry_backoff_s`; code reads env/defaults only in `harness/agents/spawn.py:284`.
- `_role_defaults` are loaded but not applied in `Roster.role()`: defaults are fetched in `harness/roles.py:224` and then ignored. Current `roles.yaml` repeats fields, masking this.
- `Repo.commit()` does not match the doc’s `commit(message, paths)` contract. It only commits already-staged changes in `harness/workspace/repo.py:97`.
- Pipeline tee logging is defined but never used by `subtask()`, `ticket()`, or `backlog()`. See `harness/telemetry/logging.py:42`; no call sites.
- `doctor vision` parity is missing: `harness/cli.py:120` returns “not yet wired”, while §10 maps `qwen_vision_smoke.sh` to this subcommand.

## NEW GAPS IN THE SPEC
- `Role.execute()` audits filesystem changes caused by the harness itself, especially `invocation.out_file` and qwen OpenAI logs. The spec needs an explicit “harness artifact paths are excluded from scope audit” rule, or roles like implementer/QA/rescue will self-violate.
- The doc still says `Repo.commit(paths)` while bash and Python `commit_verified()` stage broadly except `harness/`. That contract needs reconciliation before cutover.

## BUGS / CORRECTNESS
- Blocker: writable roles can fail solely because `spawn()` creates artifacts under `tickets/`. `Role.execute()` snapshots before `agent.run()` in `harness/roles.py:84`, `spawn()` creates/truncates `out_file` in `harness/agents/spawn.py:185`, and implementer scope denies `tickets/**` in `harness/roles.yaml:70`. Result: qwen implementer/QA/rescue tiers are likely downgraded to `SCOPE_VIOLATION` before acceptance.
- `scope_audit()` mishandles cross-scope renames. For `R`, it classifies old/new independently and only checks out paths individually in `harness/git_helpers.py:85`; for unstaged rename it can see `D game/foo` as in-scope and remove only the new out-of-scope file. Spec requires restoring both sides.
- `scope_audit()` swallows failed revert/remove operations in `harness/git_helpers.py:115`, so a dirty workspace can continue while reporting only a violation.
- `rescue()` commits even if the rescue role failed or was rejected by scope audit. It calls `commit_verified()` unconditionally in `harness/steps/rescue.py:40`; `ticket()` checks `accepted_by` only afterward in `harness/pipelines/ticket.py:241`.
- `verify_reviews()` does not restore deleted live review files; it skips when `live.exists()` is false in `harness/steps/protect_review.py:40`.
- Progress server lifecycle is not tied to supervisor termination. `start_if_needed()` starts a detached session in `harness/telemetry/progress_server.py:54`, and `Supervisor.run()` installs only SIGHUP in `harness/supervisor.py:52`.

## TEST COVERAGE
145 passing tests cover important pieces: argv construction including agy no-`--model`, classifier basics, subprocess timeout/kill, acceptance recovery, config merge, several subtask happy/fail paths, protect-review modification restore, and the untracked-before scope baseline.

Important gaps:
- No test for `Role.execute()` with a real writable qwen-like agent plus artifact output under denied `tickets/**`.
- `test_scope_audit.py` claims rename coverage but has no rename test.
- No ticket-level integration tests for failed subs, decompose failure, rescue, split, finalize enum routing, backlog rc=3, supervisor SIGHUP/decay, or progress server lifecycle.
- No tests for `Repo.commit` contract, tee log wiring, deleted review restore, `doctor vision`, or tunables driving `spawn()`.

## READY FOR PHASE 5 CUTOVER?
No. Apart from the deferred recorded-fixture equivalence test, the artifact/scope-audit interaction and unconditional rescue commit are substantive production blockers. The rename restore bug is also serious because it can leave source files deleted after a rejected tier.

## NITS
- A few comments still say “Phase 2/3/4 may add” in shipped code, e.g. `harness/agents/qwen.py:186`.
- Tests sometimes assert a weaker behavior than their docstring promises, notably split parsing and scope rename coverage.
