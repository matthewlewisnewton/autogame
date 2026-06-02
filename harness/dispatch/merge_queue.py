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


def _default_merge_ff(main_repo: Repo, h: WorkerHandle) -> bool:
    """Fast-forward main to the (already-rebased) worker branch tip."""
    try:
        main_repo.run_git("merge", "--ff-only", h.worktree.branch, capture=False)
        return True
    except subprocess.CalledProcessError:
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


@dataclass
class MergeQueue:
    main_repo: Repo
    queue: BeadsQueue
    rebase: Optional[Callable[[WorkerHandle], bool]] = None
    verify: Optional[Callable[[Path], bool]] = None
    merge: Optional[Callable[[WorkerHandle], bool]] = None

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
        if not self.rebase(h):
            return self._reject(h, "rebase conflict with main")
        if not self.verify(h.worktree.root):
            return self._reject(h, "post-rebase verification failed")
        if not self.merge(h):
            return self._reject(h, "fast-forward merge failed")
        self._close_merged(h)
        emit_progress_event("merge_done",
                            {"ticket": h.ticket_id, "branch": h.worktree.branch})
        h.worktree.remove_worktree()

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
        try:
            self.queue.requeue(h.ticket_id, note=f"merge rejected: {reason}")
        except Exception as e:
            log(f"[merge] WARN: requeue of {h.ticket_id} failed: {e!r}")
        self._clear_pending(h)  # back to ready — a fresh pass will re-record it
        h.worktree.remove_worktree()


__all__ = ["MergeQueue", "PENDING_MERGE", "MERGED_UNCLOSED",
           "read_pending", "resolve_pending"]
