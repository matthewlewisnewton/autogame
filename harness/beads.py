"""BeadsQueue — thin wrapper over the `bd` (beads) CLI.

The parallel dispatcher's queue interface. beads gives us a git-native,
dependency-aware ready-work queue with an atomic claim:

  - `bd ready -l difficulty:<x> --claim --json` atomically grabs the first
    ready (no open blockers, not already in_progress) issue in a lane.
  - dependencies (`bd dep add`) are respected by `bd ready`.
  - tickets carry a `difficulty:<easy|medium|hard>` label = their lane.

The dispatcher is the SOLE beads writer (embedded single-writer Dolt is then
fine — no server needed). Workers never touch beads.
"""
from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path
from typing import Optional

DIFFICULTY_LABEL = "difficulty:{}"


def bd_available(bd: str = "bd") -> bool:
    return shutil.which(bd) is not None


class BeadsError(RuntimeError):
    pass


class BeadsQueue:
    def __init__(self, root: Path, *, bd: str = "bd"):
        self.root = Path(root)
        self.bd = bd

    def _run(self, *args: str, check: bool = True) -> subprocess.CompletedProcess:
        proc = subprocess.run(
            [self.bd, *args], cwd=str(self.root),
            capture_output=True, text=True,
        )
        if check and proc.returncode != 0:
            raise BeadsError(f"bd {' '.join(args)} failed (rc={proc.returncode}): "
                             f"{proc.stderr.strip() or proc.stdout.strip()}")
        return proc

    def _run_json(self, *args: str) -> list[dict]:
        out = self._run(*args).stdout.strip()
        if not out:
            return []
        try:
            data = json.loads(out)
        except json.JSONDecodeError as e:
            raise BeadsError(f"bd {' '.join(args)}: non-JSON output: {e}") from e
        return data if isinstance(data, list) else [data]

    # --- reads ---------------------------------------------------------- #
    def ready(self, *, difficulty: Optional[str] = None, limit: int = 100) -> list[dict]:
        """Ready issues (no open blockers, not in_progress), optionally one lane."""
        args = ["ready", "--json", "-n", str(limit)]
        if difficulty:
            args += ["-l", DIFFICULTY_LABEL.format(difficulty)]
        return self._run_json(*args)

    def show(self, issue_id: str) -> Optional[dict]:
        rows = self._run_json("show", issue_id, "--json")
        return rows[0] if rows else None

    def in_progress(self) -> list[dict]:
        """Issues currently claimed (status=in_progress) — used by reconcile to
        find work orphaned by a dispatcher crash."""
        return self._run_json("list", "--status", "in_progress", "--json")

    # --- claim / release ------------------------------------------------ #
    def claim_ready(self, *, difficulty: Optional[str] = None,
                    assignee: Optional[str] = None) -> Optional[dict]:
        """Atomically claim the first ready issue in the lane (status →
        in_progress). Returns the claimed issue dict, or None if none ready.
        Optionally re-assign to `assignee` (the chosen agent)."""
        args = ["ready", "--claim", "--json"]
        if difficulty:
            args += ["-l", DIFFICULTY_LABEL.format(difficulty)]
        rows = self._run_json(*args)
        if not rows:
            return None
        issue = rows[0]
        if assignee:
            # The ticket is ALREADY atomically claimed (status=in_progress, owned
            # by the bd actor) by `ready --claim`. Re-assigning to the chosen
            # agent is for human visibility only; make it best-effort so a failed
            # assign can never wedge an already-claimed ticket.
            try:
                self.assign(issue["id"], assignee)
                issue["assignee"] = assignee
            except BeadsError:
                pass
        return issue

    def assign(self, issue_id: str, assignee: str) -> None:
        self._run("assign", issue_id, assignee)

    def requeue(self, issue_id: str, *, note: Optional[str] = None) -> None:
        """Return a claimed/in_progress issue to the ready pool: clear assignee
        and reset status to open. Used by the circuit-breaker when an agent
        fails on quota/unavailability."""
        if note:
            self._run("note", issue_id, note, check=False)
        # Reset to open + clear assignee so `bd ready` surfaces it again. MUST
        # succeed (check=True): a silently-failed requeue loses the ticket from
        # the pool entirely, stuck in_progress under a now-disabled agent.
        self._run("update", issue_id, "--status", "open", "--assignee", "", check=True)

    def close(self, issue_id: str, reason: str = "done") -> None:
        self._run("close", issue_id, "--reason", reason)

    # --- writes (migration / setup) ------------------------------------- #
    def create(self, title: str, *, difficulty: Optional[str] = None,
               priority: Optional[int] = None) -> str:
        args = ["q", title]
        if priority is not None:
            args += ["-p", str(priority)]
        if difficulty:
            # Label atomically at creation (-l) so a crash can't leave an
            # unlabeled, lane-invisible ticket between create and label.
            args += ["-l", DIFFICULTY_LABEL.format(difficulty)]
        return self._run(*args).stdout.strip()

    def add_label(self, issue_id: str, label: str) -> None:
        self._run("label", "add", issue_id, label)

    def add_dep(self, blocked_id: str, blocker_id: str) -> None:
        """blocked_id depends on (is blocked by) blocker_id."""
        self._run("dep", "add", blocked_id, blocker_id)


__all__ = ["BeadsQueue", "BeadsError", "bd_available", "DIFFICULTY_LABEL"]
