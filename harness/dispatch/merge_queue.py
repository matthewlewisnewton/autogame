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
from collections import deque
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Optional

from harness.beads import BeadsQueue
from harness.dispatch.dispatcher import WorkerHandle
from harness.telemetry.logging import log
from harness.telemetry.progress import emit_progress_event
from harness.workspace.repo import Repo


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
    game/ dir — the worker already installed node_modules there."""
    from harness.steps.vitest_cleanup import run_vitest
    game = Path(worktree_root) / "game"
    if not game.exists():
        return True
    for project in ("server", "client"):
        try:
            rc = run_vitest(["run", "--project", project], cwd=game, timeout_s=300)
        except FileNotFoundError:
            return False
        if rc != 0:
            return False
    return True


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

    def enqueue(self, h: WorkerHandle) -> None:
        self._pending.append(h)
        emit_progress_event("merge_enqueue",
                            {"ticket": h.ticket_id, "branch": h.worktree.branch})

    def pending(self) -> int:
        return len(self._pending)

    def drain_one(self) -> bool:
        """Process the next queued branch (FIFO). Returns False if empty."""
        if not self._pending:
            return False
        self._merge_one(self._pending.popleft())
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
        try:
            self.queue.close(h.ticket_id, "merged to main")
        except Exception as e:
            log(f"[merge] WARN: merged {h.ticket_id} but bd close failed: {e!r}")
        emit_progress_event("merge_done",
                            {"ticket": h.ticket_id, "branch": h.worktree.branch})
        h.worktree.remove_worktree()

    def _reject(self, h: WorkerHandle, reason: str) -> None:
        log(f"[merge] {h.ticket_id} NOT merged ({reason}) — main untouched, requeuing")
        emit_progress_event("merge_rejected", {"ticket": h.ticket_id, "reason": reason})
        try:
            self.queue.requeue(h.ticket_id, note=f"merge rejected: {reason}")
        except Exception as e:
            log(f"[merge] WARN: requeue of {h.ticket_id} failed: {e!r}")
        h.worktree.remove_worktree()


__all__ = ["MergeQueue"]
