## ROUND 3 BLOCKERS — STATUS
Scope-audit wiring is fixed. `Role.execute` now owns per-tier auditing, captures `head_before` internally, no longer depends on a nonexistent `ChainResult.head_before`, and gives writable tiers natural fallback-on-scope-violation behavior.

Untracked-file detection is only partially fixed. v4 adds `git status --porcelain --untracked-files=all`, so untracked files are visible, but it only snapshots `workspace.head()` before the agent. That cannot distinguish files created by this agent call from untracked files already present before the call.

## NEW PROBLEMS IN v4
The new untracked logic can false-positive and delete unrelated pre-existing untracked files in `scope_audit`, because `??` after the run is treated as “agent created.” The fixture recorder has the same issue: it can repeatedly record pre-existing untracked artifacts as per-call filesystem deltas. Fix by capturing a pre-call untracked/status baseline and subtracting it, or by specifying and enforcing a clean-worktree invariant before every audited/recorded call.

§7.4 also still has stale “pipeline caller decides” language, contradicting the new `Role.execute` ownership. That is smaller, but should be cleaned up to avoid implementing both models.

## READY TO IMPLEMENT?
No. One substantive blocker remains: untracked detection needs a before/after baseline, not just post-call `git status`.

## NITS
None.
