"""MergeQueue — serialized integration of passed worker branches into main.

When a worker's ticket passes review, its `auto/<id>` branch must land on
`main`. The merge queue does this as a single serialized transaction per branch
(the dispatcher is the sole writer of main, so one-at-a-time is correct):

  1. rebase the worker branch onto current `main` (in its worktree),
  2. re-verify the rebased tree (vitest server+client — catches integration
     breakage the rebase introduced even without a textual conflict),
  3. fast-forward `main` to the rebased tip,
  4. `bd close` the ticket and tear down the worktree + branch.

Any failure leaves `main` untouched and requeues the ticket (back to `bd ready`)
— never a half-merged main. rebase/verify/merge are injected so the transaction
logic unit-tests with fakes (no real git/vitest).
"""
from __future__ import annotations

import subprocess
import time
from collections import deque
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Optional

from harness.beads import BeadsQueue
from harness.dispatch.dispatcher import WorkerHandle
from harness.telemetry.logging import log
from harness.telemetry.progress import emit_progress_event, locked_append
from harness.workspace.repo import Repo

# Beads that were merged to main but whose `bd close` failed are recorded here
# (one id per line, in the main checkout) so reconcile CLOSES them on next
# startup instead of requeuing an already-merged ticket onto a deleted branch.
MERGED_UNCLOSED = ".beads_merged_unclosed"

# Beads that PASSED review and are awaiting merge are recorded here (one
# `bead_id\tticket_name` per line, in the main checkout). The merge queue is
# otherwise in-memory, so a restart/crash between review-PASS and the actual
# ff-merge would lose the branch entirely (reconcile deletes all auto/* branches)
# and re-run the whole ticket from scratch. This durable record lets reconcile
# PRESERVE the passed branch + its worktree and re-enqueue the merge instead.
PENDING_MERGE = ".beads_pending_merge"

# How many times to re-rebase+ff a passed branch when the ff fails because main
# advanced under us (a concurrent writer to main during the multi-minute verify).
# Bounded so a genuinely un-fast-forwardable branch still ends in a safe reject.
MERGE_FF_ATTEMPTS = 3


def _pending_path(root) -> Path:
    return Path(root) / PENDING_MERGE


def read_pending(root) -> list[tuple[str, str]]:
    """Return [(bead_id, ticket_name)] for branches that passed review and are
    awaiting merge. Tolerates a missing/garbled file (returns what it can)."""
    try:
        text = _pending_path(root).read_text()
    except OSError:
        return []
    out: list[tuple[str, str]] = []
    for ln in text.splitlines():
        parts = ln.split("\t")
        if len(parts) >= 2 and parts[0].strip() and parts[1].strip():
            out.append((parts[0].strip(), parts[1].strip()))
    return out


def _record_pending(root, bead_id: str, name: str) -> None:
    """Durably note that `bead_id` (ticket dir `name`) passed and awaits merge.
    Idempotent — the same bead is never recorded twice."""
    if any(b == bead_id for b, _ in read_pending(root)):
        return
    locked_append(_pending_path(root), f"{bead_id}\t{name}")


def resolve_pending(root, bead_id: str) -> None:
    """Drop `bead_id` from the pending-merge file (its merge resolved: merged +
    closed, recorded merged-unclosed, rejected back to ready, or found stale).
    The dispatcher is the sole writer of this file, so a plain rewrite is safe."""
    path = _pending_path(root)
    remaining = [(b, n) for b, n in read_pending(root) if b != bead_id]
    try:
        if remaining:
            path.write_text("".join(f"{b}\t{n}\n" for b, n in remaining))
        else:
            path.unlink(missing_ok=True)
    except OSError as e:
        log(f"[merge] WARN: could not update {PENDING_MERGE}: {e!r}")


def _default_rebase(main_repo: Repo, h: WorkerHandle) -> bool:
    """Rebase the worker's branch onto current main, inside its worktree."""
    try:
        h.worktree.run_git("rebase", main_repo.branch, capture=False)
        return True
    except subprocess.CalledProcessError:
        try:
            h.worktree.run_git("rebase", "--abort", check=False, capture=False)
        except Exception:
            pass
        return False


def _restore_beads_export(main_repo: Repo) -> bool:
    """Discard local modifications to the passive `.beads/*` export in the main
    checkout (the continuously-rewritten interactions/issues jsonl). These are
    derived files — beads's source of truth is the Dolt DB — so restoring them
    is always safe, and they are the recurring reason `merge --ff-only` refuses
    with 'local changes would be overwritten'."""
    try:
        dirty = main_repo.run_git("status", "--porcelain", "--", ".beads")
    except Exception:
        return False
    if not dirty.strip():
        return False
    try:
        main_repo.run_git("checkout", "--", ".beads", capture=False)
        log("[merge] restored locally-modified .beads/* export before ff retry")
        return True
    except Exception as e:
        log(f"[merge] could not restore .beads/* export: {e!r}")
        return False


def _default_merge_ff(main_repo: Repo, h: WorkerHandle) -> bool:
    """Fast-forward main to the (already-rebased) worker branch tip.

    Not every ff failure means "main advanced" (the only case the caller's
    re-rebase loop can fix), so classify before giving up — each False returned
    here costs the caller one of its MERGE_FF_ATTEMPTS and can ultimately reject
    a perfectly good branch:
      - 'local changes would be overwritten' by the passive `.beads/*` export →
        restore the export and retry (derived data, always safe to discard);
      - a transient ref/index lock (a worker's concurrent git op in the shared
        .git) → short sleep and retry, NOT a verify-invalidating event;
      - anything else (genuine non-ff, unknown) → log + False as before."""
    for attempt in range(3):
        try:
            main_repo.run_git("merge", "--ff-only", h.worktree.branch)
            return True
        except subprocess.CalledProcessError as e:
            detail = (getattr(e, "stderr", "") or getattr(e, "stdout", "") or "").strip()[-600:]
            lowered = detail.lower()
            if attempt < 2 and ("would be overwritten" in lowered
                                or "local changes" in lowered):
                if _restore_beads_export(main_repo):
                    continue  # blocker was the derived export — retry the ff
            elif attempt < 2 and (".lock" in lowered or "unable to create" in lowered):
                log(f"[merge] ff-only hit a transient git lock ({detail!r}) — retrying")
                time.sleep(1.5)
                continue
            log(f"[merge] ff-only of {h.worktree.branch} FAILED: {detail!r}")
            try:
                dirty = main_repo.run_git("status", "--porcelain").strip()[:600]
                log(f"[merge] main working-tree at ff-failure: {dirty!r}")
            except Exception:
                pass
            return False
    return False


def _default_verify(worktree_root: Path) -> bool:
    """Run the harness's own check (vitest server + client) in the worktree's
    game/ dir — the worker already installed node_modules there. Any error (a
    missing toolchain, a vitest timeout, a bad invocation) counts as a verify
    FAILURE, never an exception that escapes — a raised error here would crash the
    whole dispatcher via merge_drain()."""
    from harness.steps.vitest_cleanup import run_vitest
    game = Path(worktree_root) / "game"
    if not game.exists():
        return True
    try:
        with open(game / ".merge-verify.log", "wb") as out:
            for project in ("server", "client"):
                rc = run_vitest(["run", "--project", project], cwd=game,
                                timeout_s=300, stdout=out)
                if rc != 0:
                    return False
        return True
    except Exception as e:
        log(f"[merge] verify raised {e!r} — treating as verification failure")
        return False


def _unmerged_files(wt) -> list[str]:
    """Paths left in conflict (unmerged) in the worktree."""
    try:
        out = wt.run_git("diff", "--name-only", "--diff-filter=U")
    except Exception:
        return []
    return [ln.strip() for ln in out.splitlines() if ln.strip()]


def _branch_commit_subjects(wt, main_branch: str) -> str:
    """The passed branch's own commit subjects (its intent) — `<main>..HEAD`.
    This is the COMPACT context the resolver gets instead of a full review/diff."""
    try:
        return wt.run_git("log", f"{main_branch}..HEAD", "--format=- %s").strip()
    except Exception:
        return "(could not read branch commits)"


def _has_conflict_markers(wt, files: list[str]) -> bool:
    """True if any listed file still contains a git conflict marker."""
    for rel in files:
        try:
            text = (Path(wt.root) / rel).read_text(errors="replace")
        except OSError:
            continue
        if "<<<<<<<" in text or ">>>>>>>" in text or "\n=======\n" in text:
            return True
    return False


def _find_review_md(main_root, ticket_name: str) -> Optional[Path]:
    """Latest review.md for the ticket (compact-context pointer for the resolver)."""
    try:
        cands = sorted((Path(main_root) / "tickets" / ticket_name).glob("round-*/review.md"))
        return cands[-1] if cands else None
    except OSError:
        return None


def _default_resolve(main_repo: Repo, roster, h: WorkerHandle) -> bool:
    """Integrate current main into the passed branch, resolving any textual
    conflict with the context-aware `merge_resolve` agent. Returns True iff the
    branch now cleanly contains main (no unmerged paths, no markers, merge
    committed) — ready to ff. On any failure leaves the worktree clean (merge
    aborted) and returns False, so the caller safely rejects (main untouched).

    Uses a MERGE (not a rebase) so the agent resolves ONE conflict set in place,
    and the branch ends a descendant of main → the subsequent `--ff-only` works."""
    wt = h.worktree
    try:
        wt.run_git("merge", "--no-edit", main_repo.branch, capture=False)
        return True  # clean merge — main had no overlapping change
    except subprocess.CalledProcessError:
        pass  # conflict — fall through to agent resolution
    except Exception as e:
        log(f"[merge] resolve: merge of {main_repo.branch} raised {e!r} — aborting")
        _abort_merge(wt)
        return False

    files = _unmerged_files(wt)
    if not files or roster is None:
        _abort_merge(wt)
        return False
    review = _find_review_md(main_repo.root, h.ticket_name)
    art = Path(wt.root) / ".merge-resolve"
    try:
        art.mkdir(parents=True, exist_ok=True)
    except OSError:
        pass
    try:
        role = roster.role("merge_resolve")
        chain = role.execute(
            workspace=wt,
            prompt_vars={
                "CONFLICT_FILES": "\n".join(files),
                "CHANGE_COMMITS": _branch_commit_subjects(wt, main_repo.branch),
                "REVIEW_FILE": str(review) if review else "(no review.md found)",
            },
            artifacts_dir=art,
            telemetry=None,
        )
    except Exception as e:
        log(f"[merge] resolve: merge_resolve agent raised {e!r} — aborting")
        _abort_merge(wt)
        return False
    if chain.accepted_by is None:
        log(f"[merge] resolve: {h.ticket_id} resolver tier exhausted — aborting merge")
        _abort_merge(wt)
        return False
    # Stage the agent's resolution (it edited the working tree but won't have
    # `git add`ed — and we forbid it from running git), THEN validate: the marker
    # content check is what actually proves the conflict is gone (after `add`,
    # git's own unmerged list is cleared whether or not markers remain).
    try:
        wt.run_git("add", "-A", capture=False)
    except Exception as e:
        log(f"[merge] resolve: staging resolution failed ({e!r}) — aborting")
        _abort_merge(wt)
        return False
    if _unmerged_files(wt) or _has_conflict_markers(wt, files):
        log(f"[merge] resolve: {h.ticket_id} not cleanly resolved (markers remain) — aborting merge")
        _abort_merge(wt)
        return False
    try:
        wt.run_git("commit", "--no-edit", capture=False)
    except Exception as e:
        log(f"[merge] resolve: completing merge commit failed ({e!r}) — aborting")
        _abort_merge(wt)
        return False
    log(f"[merge] resolve: {h.ticket_id} conflict resolved by {chain.accepted_by.name}")
    return True


def _abort_merge(wt) -> None:
    try:
        wt.run_git("merge", "--abort", check=False, capture=False)
    except Exception:
        pass


def _verify_log_tail(wt, *, max_chars: int = 3000) -> str:
    """Tail of the merge-verify vitest log (written by _default_verify)."""
    try:
        text = (Path(wt.root) / "game" / ".merge-verify.log").read_text(errors="replace")
    except OSError:
        return "(verify log unavailable)"
    return text[-max_chars:] if text else "(verify log empty)"


def _default_fix(main_repo: Repo, roster, h: WorkerHandle) -> bool:
    """One bounded attempt to repair a SEMANTIC conflict: the branch rebased
    cleanly onto main but the combined tree fails verification. Hand the
    `merge_fix` agent the verify-log tail + the branch's intent, let it edit
    the integrated tree in place, then commit its edits. Returns True iff the
    agent was accepted AND actually changed something (a no-op "fix" can't
    make the re-verify pass, so it's reported as failure and the caller
    rejects). The caller ALWAYS re-verifies before anything lands on main."""
    if roster is None:
        return False
    wt = h.worktree
    review = _find_review_md(main_repo.root, h.ticket_name)
    art = Path(wt.root) / ".merge-fix"
    try:
        art.mkdir(parents=True, exist_ok=True)
    except OSError:
        pass
    try:
        role = roster.role("merge_fix")
        chain = role.execute(
            workspace=wt,
            prompt_vars={
                "CHANGE_COMMITS": _branch_commit_subjects(wt, main_repo.branch),
                "REVIEW_FILE": str(review) if review else "(no review.md found)",
                "VERIFY_LOG": str(Path(wt.root) / "game" / ".merge-verify.log"),
                "VERIFY_TAIL": _verify_log_tail(wt),
            },
            artifacts_dir=art,
            telemetry=None,
        )
    except Exception as e:
        log(f"[merge] fix: merge_fix agent raised {e!r}")
        return False
    if chain.accepted_by is None:
        log(f"[merge] fix: {h.ticket_id} fixer tier exhausted")
        return False
    try:
        if not wt.run_git("status", "--porcelain").strip():
            log(f"[merge] fix: {h.ticket_id} agent made no changes")
            return False
        wt.run_git("add", "-A", capture=False)
        wt.run_git("commit", "-m",
                   "merge-fix: reconcile with main after clean rebase broke verification",
                   capture=False)
    except Exception as e:
        log(f"[merge] fix: committing fix failed ({e!r})")
        return False
    log(f"[merge] fix: {h.ticket_id} integrated-tree fix by {chain.accepted_by.name}")
    return True


@dataclass
class MergeQueue:
    main_repo: Repo
    queue: BeadsQueue
    rebase: Optional[Callable[[WorkerHandle], bool]] = None
    verify: Optional[Callable[[Path], bool]] = None
    merge: Optional[Callable[[WorkerHandle], bool]] = None
    # Context-aware conflict resolver: integrate current main into the passed
    # branch (merging, not rebasing) and resolve any conflict with an agent that
    # has the change's intent. Returns True if the branch now cleanly contains
    # main (ready to ff). None (the default) = no resolver → a rebase conflict
    # falls straight to reject (the pre-resolver behavior). factory wires the real
    # one (it needs the roster); unit tests inject a fake.
    resolve: Optional[Callable[[WorkerHandle], bool]] = None
    # Post-rebase SEMANTIC-conflict fixer: the branch rebased cleanly but the
    # combined tree fails verification. One bounded agent attempt to fix the
    # integrated tree in place (then mandatory re-verify) before we reject and
    # throw away a whole passed ticket run. None = reject immediately (the
    # pre-fixer behavior). factory wires the real one; unit tests inject fakes.
    fix: Optional[Callable[[WorkerHandle], bool]] = None
    # Called when a PASSED branch fails to integrate (rebase conflict or, the
    # common case, post-rebase verification failure). The dispatcher's breaker
    # uses this to COUNT merge-integration failures — the dominant churn mode the
    # worker-side breaker can't see (the worker passed; the failure is downstream)
    # — and to abandon a ticket that can never integrate. Returns True if it
    # handled the ticket (e.g. abandoned it) and the merge queue must NOT requeue;
    # False/None → requeue as before. factory wires disp.note_merge_reject.
    on_reject: Optional[Callable[[str, str], bool]] = None

    _pending: "deque[WorkerHandle]" = field(default_factory=deque, init=False)

    def __post_init__(self):
        if self.rebase is None:
            self.rebase = lambda h: _default_rebase(self.main_repo, h)
        if self.verify is None:
            self.verify = _default_verify
        if self.merge is None:
            self.merge = lambda h: _default_merge_ff(self.main_repo, h)

    def enqueue(self, h: WorkerHandle, *, record: bool = True) -> None:
        """Queue a passed branch for merge. `record=True` durably notes it in
        PENDING_MERGE so a restart can recover it; reconcile's own rebuild passes
        record=False (the entry is already on disk)."""
        self._pending.append(h)
        if record and self.main_repo is not None:
            _record_pending(self.main_repo.root, h.ticket_id, h.ticket_name)
        emit_progress_event("merge_enqueue",
                            {"ticket": h.ticket_id, "branch": h.worktree.branch})

    def pending(self) -> int:
        return len(self._pending)

    def drain_one(self) -> bool:
        """Process the next queued branch (FIFO). Returns False if empty. Never
        raises — a merge that blows up must not crash the dispatcher's tick loop;
        it's rejected (requeued) and the loop continues."""
        if not self._pending:
            return False
        h = self._pending.popleft()
        try:
            self._merge_one(h)
        except Exception as e:
            log(f"[merge] unexpected error merging {h.ticket_id}: {e!r} — requeuing")
            try:
                self._reject(h, f"merge crashed: {e!r}")
            except Exception as e2:
                log(f"[merge] reject after crash also failed for {h.ticket_id}: {e2!r}")
        return True

    def drain_all(self) -> int:
        n = 0
        while self.drain_one():
            n += 1
        return n

    # --- transaction ---------------------------------------------------- #
    def _merge_one(self, h: WorkerHandle) -> None:
        """Integrate the passed branch into main: get it onto current main →
        re-verify → ff-merge, tolerant of a moving main AND of textual conflicts.

        Two things can go wrong when bringing the branch onto current main:
          1. main ADVANCED with non-conflicting work (a concurrent writer, or a
             merge that landed during this branch's multi-minute verify). The
             clean rebase succeeds; only the ff can fail ("Not possible to
             fast-forward") — we re-integrate and retry (bounded).
          2. main advanced with CONFLICTING work (two branches edited the same
             lines — the world-stage/registry livelock). The rebase conflicts.
             Rather than discard the passed work and re-run the whole ticket, we
             hand it to the context-aware `resolve` step (merge main in + an agent
             that has the change's intent), which preserves the work. We ALWAYS
             re-verify the integrated tree before it can land, so a bad resolution
             never reaches main. Out of attempts / no resolver → safe reject."""
        verified_against: Optional[str] = None
        integrated_via_resolve = False
        fix_attempted = False
        for attempt in range(MERGE_FF_ATTEMPTS):
            if integrated_via_resolve:
                # A prior resolve already merged main into the branch; main has
                # since moved (ff failed). Re-integrate by MERGING the newer main
                # (re-resolving if it conflicts) — never rebase, which would drop
                # the resolution commit.
                if self.resolve is None or not self.resolve(h):
                    return self._reject(h, "merge resolve failed on re-integration")
                verified_against = None
            elif not self.rebase(h):
                # rebase conflict — resolve with context instead of re-running.
                if self.resolve is None:
                    return self._reject(h, "rebase conflict with main")
                log(f"[merge] {h.ticket_id} rebase conflict with main — invoking "
                    f"context-aware resolver (preserving passed work)")
                if not self.resolve(h):
                    return self._reject(h, "rebase conflict; resolver could not integrate")
                integrated_via_resolve = True
                verified_against = None
            main_head = self._main_head()
            if main_head is None or main_head != verified_against:
                if not self.verify(h.worktree.root):
                    # The branch integrated cleanly but the COMBINED tree fails —
                    # a semantic conflict with what landed on main. Before
                    # throwing away a whole passed ticket run, give the fixer
                    # agent ONE shot (per merge transaction) at repairing the
                    # integrated tree, then demand a clean re-verify.
                    if self.fix is None or fix_attempted:
                        return self._reject(h, "post-rebase verification failed")
                    fix_attempted = True
                    log(f"[merge] {h.ticket_id} post-rebase verification failed — "
                        f"attempting integrated-tree fix (preserving passed work)")
                    emit_progress_event("merge_fix_start", {"ticket": h.ticket_id})
                    if not self.fix(h):
                        return self._reject(
                            h, "post-rebase verification failed; fix attempt unsuccessful")
                    if not self.verify(h.worktree.root):
                        return self._reject(
                            h, "post-rebase verification failed even after fix")
                    emit_progress_event("merge_fixed", {"ticket": h.ticket_id})
                verified_against = main_head
            if self.merge(h):
                self._close_merged(h)
                emit_progress_event("merge_done",
                                    {"ticket": h.ticket_id, "branch": h.worktree.branch,
                                     "resolved": integrated_via_resolve})
                h.worktree.remove_worktree()
                return
            log(f"[merge] {h.ticket_id} ff failed (main advanced under verify); "
                f"re-integrating and retrying (attempt {attempt + 1}/{MERGE_FF_ATTEMPTS})")
        return self._reject(h, f"fast-forward merge failed after {MERGE_FF_ATTEMPTS} attempts")

    def _main_head(self) -> Optional[str]:
        """Current main HEAD sha, used to detect a concurrent writer advancing
        main between verify and ff. None if unavailable (tests / git error) —
        callers treat None as 'unknown', forcing a re-verify to stay safe."""
        if self.main_repo is None:
            return None
        try:
            return self.main_repo.run_git("rev-parse", "HEAD").strip()
        except Exception:
            return None

    def _clear_pending(self, h: WorkerHandle) -> None:
        """Drop the durable pending-merge record for a now-resolved branch."""
        if self.main_repo is not None:
            resolve_pending(self.main_repo.root, h.ticket_id)

    def _close_merged(self, h: WorkerHandle) -> None:
        """Close the bead after a successful merge to main. The code is ALREADY
        on main, so this must not requeue on failure (that would re-run merged
        work). Retry a few times; if `bd close` still fails, record the id durably
        so reconcile closes it on the next dispatcher startup."""
        last: Optional[Exception] = None
        for attempt in range(3):
            try:
                self.queue.close(h.ticket_id, "merged to main")
                self._clear_pending(h)
                return
            except Exception as e:
                last = e
                time.sleep(0.5 * (attempt + 1))
        log(f"[merge] ERROR: merged {h.ticket_id} to main but bd close failed 3x "
            f"({last!r}); recording to {MERGED_UNCLOSED} for reconcile to close")
        try:
            locked_append(Path(self.main_repo.root) / MERGED_UNCLOSED, h.ticket_id)
        except OSError as e:
            log(f"[merge] WARN: could not record merged-unclosed {h.ticket_id}: {e!r}")
        self._clear_pending(h)  # merge is done (on main); reconcile owns the close
        emit_progress_event("merge_close_failed", {"ticket": h.ticket_id})

    def _reject(self, h: WorkerHandle, reason: str) -> None:
        log(f"[merge] {h.ticket_id} NOT merged ({reason}) — main untouched, requeuing")
        emit_progress_event("merge_rejected", {"ticket": h.ticket_id, "reason": reason})
        # Feed the staleness breaker: a passed-but-unmergeable ticket churns by
        # re-running from scratch every reject (the worker keeps passing). Let the
        # dispatcher count it and decide — it may ABANDON the ticket (handled=True),
        # in which case we must NOT requeue it back into the ready pool.
        handled = False
        if self.on_reject is not None:
            try:
                handled = bool(self.on_reject(h.ticket_id, reason))
            except Exception as e:
                log(f"[merge] WARN: on_reject hook failed for {h.ticket_id}: {e!r}")
        if not handled:
            try:
                self.queue.requeue(h.ticket_id, note=f"merge rejected: {reason}")
            except Exception as e:
                log(f"[merge] WARN: requeue of {h.ticket_id} failed: {e!r}")
        self._clear_pending(h)  # back to ready — a fresh pass will re-record it
        h.worktree.remove_worktree()


__all__ = ["MergeQueue", "PENDING_MERGE", "MERGED_UNCLOSED",
           "read_pending", "resolve_pending"]
