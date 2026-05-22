## ROUND 2 BLOCKERS — STATUS

- [FIXED] `ticket()` control flow for `sub_rc == 1`, decompose failure, and SCOPE-CONFLICT. v3 now skips review/capture/coverage on failed subtasks, retries failed decomposition, and uses an outer-loop continue for rc=3.

- [FIXED] Review acceptance/recovery. `ReviewAccept` now requires only `review.md` with a verdict, treats `gaps.md`/`nits.md` as optional, and runs recovery before tier failure.

- [FIXED] SIGHUP hot reload. The broken walrus lambda is gone; `self.roster` is reassigned by a handler.

- [FIXED] Agent result/failure granularity and agy retry behavior. `exit_code` preserves exact rc, and spawn retries are per-agent with agy able to use zero retries.

- [FIXED] Coverage artifact placement. `coverage.log` is copied into the review artifacts dir.

- [FIXED] Finalize semantics. `COMMIT_FAILED` now escalates as rc=2; `GAME_BROKEN` continues.

- [FIXED] `ticket_allows_harness` detection. The bash grep rule is now specified.

- [FIXED] Progress server lifecycle for non-supervisor subcommands. `start_if_needed()` is called by event-emitting subcommands.

- [FIXED] Per-difficulty review fallbacks, Phase 2 test-scope note, tmux quoting, recursive merge, PR count, and commit-SHA wording.

- [PARTIALLY FIXED] Recorded-fixture equivalence. v3 correctly adds filesystem side effects and better matching keys, but the proposed capture uses `git diff --name-status HEAD_before HEAD_after`; agent-created untracked files will be missed unless the recorder also uses `git status --porcelain --untracked-files=all` or equivalent.

- [PARTIALLY FIXED] Scope audit. v3 defines an algorithm, but the skeleton still does not actually call it after every writable role as claimed. `subtask()` has no implementer audit, rescue/split/repair are not audited, and the one review audit references `review_chain.head_before` even though `ChainResult` has no such field.

## NEW PROBLEMS IN v3

The scope-audit and fixture-recording designs both rely on `git diff` in ways that miss untracked files. That breaks exactly the cases v3 claims to cover: newly created out-of-scope files and agent-written review/subticket/split artifacts.

The new review audit placement is also inconsistent with the stated fallback behavior. §7.4 says a reviewer scope violation can downgrade the tier so the role chain may fall through, but §8.2 audits only after `Role.execute()` has already chosen a final accepted chain result.

## READY TO IMPLEMENT?

No.

Blockers: fix untracked-file detection in `scope_audit()` and equivalence recording, and make scope auditing actually wired after each writable role/tier with a real `head_before` contract.

## NITS

Status line still says “design draft v2” despite this being v3.
