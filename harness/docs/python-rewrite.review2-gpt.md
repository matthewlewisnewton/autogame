## ROUND 1 CONCERNS — STATUS

- [FIXED] The overbuilt workflow engine was removed. §8’s plain `subtask()`, `ticket()`, and `backlog()` functions are a clear improvement over v1’s Step/combinator design.

- [FIXED] The premature Workspace ABC was addressed well. §7 now uses one concrete `Repo`, defers `WorktreeWorkspace`, and removes path scope from the workspace API.

- [PARTIALLY FIXED] The missing `run_ticket.sh` behavior is now represented in §4, §8, and §10: rescue, split, finalize, coverage, capture, protected reviews, nits, and feedback filtering are all named. But the §8.2 ticket skeleton has correctness bugs against the bash flow, so this is not yet implementation-ready.

- [PARTIALLY FIXED] Agent interface concerns are mostly handled in §5 with typed backend configs, `usage_kind`, `FailureReason`, and removal of `AgentResult.diff`. However `FailureReason.EXIT_NONZERO` collapses bash’s `exit_$rc` vocabulary, and §5.3 applies one retry policy to all agents, while bash intentionally gives `agy` no spawn retries.

- [PARTIALLY FIXED] Review acceptance was improved by §6.1’s `AcceptanceCriterion`, but `FilesWrittenAccept(files=["review.md", "gaps.md", "nits.md"])` is wrong for the current prompt: `gaps.md` is omitted on PASS, and `nits.md` is omitted when there are no nits. Also §8.2 runs recovery after `Role.execute`, meaning the role may unnecessarily fall through fallbacks before trying to recover usable chat output.

- [PARTIALLY FIXED] Runtime config is much better modeled in §6.3 with `tunables:` and `roles.local.yaml`. But the hot-reload sketch in §8.4 is broken Python: `lambda *_: (roster := Roster.reload())` does not update the outer `roster` used by the loop.

- [FIXED] The migration plan is no longer big-bang. §12 separates phased PRs, cutover, and deletion of bash with an observation window.

- [PARTIALLY FIXED] The equivalence strategy in §11.3 is directionally right, but under-specified. Recording argv/stdout/rc is not enough for writable agents that create files, edit code, create subtickets, or write split plans.

## NEW PROBLEMS IN v2

The biggest new issue is in §8.2: `ticket()` ignores `subtask()` return code `1`. Bash records failed subtasks, writes compact feedback, skips review, and continues to the next round. The v2 skeleton only handles `2` and `3`, so a failed subtask falls through to capture, coverage, and top-level review as if all subtickets passed.

§8.2 also loses bash’s decompose failure distinction. Current bash only seeds the whole ticket as a single subtask when decomposition succeeded but produced no subtickets; if the decomposer itself failed, it retries next round. The v2 `decompose(ctx, ...)` result is unchecked.

The §8.1/§8.2 SCOPE-CONFLICT path is not correct yet. `break_into_next_round(); break` breaks only the subtask loop, then the code continues to capture/review. It needs to skip directly to the next ticket round.

§6.1 and §8.2 need a review recovery redesign. Acceptance should probably be “`review.md` exists and has a verdict,” with optional `gaps.md`/`nits.md`, and recovery should happen before deciding that a tier failed acceptance.

§11.3’s recorded-fixture gate cannot produce identical commit SHAs unless it also replays filesystem side effects and fixes git author/committer dates. A mock agent returning stdout cannot recreate game edits, decomposed subtickets, review files, rescue edits, or split files.

§5/§7/§8 say `scope_audit()` runs after writable roles, but the pipeline skeletons do not actually call it after implementer, reviewer, rescue, split, or repair roles. That was one of the safety concerns from round 1 and is still only nominally addressed.

§8.2 passes `coverage_dir` to review, but the unchanged `review.md` prompt expects `coverage.log` inside `ARTIFACTS_DIR`. Bash copies it there. The Python design needs to preserve that.

## READY TO IMPLEMENT?

No.

Substantive blockers:

- Fix §8.2 ticket control flow for subtask rc `1`, decompose tool failure, and SCOPE-CONFLICT rc `3`.
- Redesign review acceptance/recovery in §6.1/§8.2 so optional files are optional and recovery happens before fallback exhaustion.
- Specify recorded-fixture replay of writable side effects in §11.3/§12, not just stdout/rc.
- Make scope auditing and commit scoping concrete in §5/§7/§8, including actual calls after every writable role.
- Fix §8.4 hot-reload semantics/code so SIGHUP really affects the next supervisor cycle.

## NITS

- §4’s tmux command likely needs shell quoting; otherwise the pipe tees the `tmux` client, not the supervisor inside the session.
- §12 says “Five sized PRs” but later includes PR #6 for deletion.
- §6.6 says field-level merge, but nested `tunables.pipeline.*` needs explicit recursive merge semantics.
