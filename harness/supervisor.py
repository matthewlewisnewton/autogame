"""Supervisor — outermost watchdog. Ports supervisor.sh per design doc §8.4."""
from __future__ import annotations

import signal
import time
from pathlib import Path
from typing import Optional

from harness.pipelines.backlog import BacklogContext, backlog
from harness.pipelines.result import PipelineResult
from harness.roles import Roster
from harness.steps.repair import repair_pass
from harness.telemetry import progress_server
from harness.telemetry.logging import log
from harness.telemetry.usage import TelemetrySink
from harness.workspace.repo import Repo


class Supervisor:
    def __init__(self, *, workspace: Repo,
                 roles_path: Path = Path("harness/roles.yaml"),
                 local_roles_path: Optional[Path] = Path("harness/roles.local.yaml"),
                 max_escalations: int = 3, suplog: Path = Path("LOOPLOG.txt")):
        self.workspace = workspace
        self.roles_path = roles_path
        self.local_roles_path = local_roles_path if local_roles_path and local_roles_path.exists() else None
        self.max_escalations = max_escalations
        self.suplog = suplog
        self.escalations = 0
        self.roster: Optional[Roster] = None
        self.telemetry = TelemetrySink()

    def _on_sighup(self, *_):
        """Reload self.roster atomically. The loop reads self.roster
        fresh on each iteration so the next ticket sees the new roster.
        v4-v5 fix: instance attribute, NOT walrus-in-lambda."""
        log("[supervisor] SIGHUP received — reloading roles.yaml + roles.local.yaml")
        try:
            self.roster = Roster.load(self.roles_path, self.local_roles_path)
            log("[supervisor] roster reload OK")
        except Exception as e:
            log(f"[supervisor] roster reload FAILED — keeping current roster: {e}")

    def _count_v0_tags(self) -> int:
        try:
            return len(self.workspace.list_tags("v0.*"))
        except Exception:
            return 0

    def _on_sigterm(self, *_):
        """SIGTERM cleanup: stop the progress server we started so the
        next supervisor boot can fork a fresh one. v5.1 hotfix per gpt
        impl-review blocker. Re-raises after cleanup so the process
        actually exits (Python's default SIGTERM handler is to terminate,
        but installing any handler suppresses that default)."""
        log("[supervisor] SIGTERM received — stopping progress server and exiting")
        try:
            progress_server.stop()
        except Exception:
            pass
        # Restore default disposition and re-deliver so the loop unwinds.
        signal.signal(signal.SIGTERM, signal.SIG_DFL)
        import os as _os
        _os.kill(_os.getpid(), signal.SIGTERM)

    def run(self) -> int:
        self.roster = Roster.load(self.roles_path, self.local_roles_path)
        progress_server.start_if_needed()
        signal.signal(signal.SIGHUP, self._on_sighup)
        signal.signal(signal.SIGTERM, self._on_sigterm)
        log(f"######## supervisor started ({time.strftime('%F %T')}) ########")

        while True:
            tags_before = self._count_v0_tags()
            log(">>> launching backlog run")
            rc = backlog(BacklogContext(
                workspace=self.workspace, roster=self.roster,
                tunables=self.roster.tunables, telemetry=self.telemetry,
            ))
            tags_after = self._count_v0_tags()
            log(f">>> backlog run exited rc={rc} (completed tickets: {tags_before} -> {tags_after})")

            # Escalation-decay (supervisor.sh:38-44).
            completed = tags_after - tags_before
            if completed > 0 and self.escalations > 0:
                prev = self.escalations
                self.escalations = max(0, self.escalations - completed)
                log(f">>> {completed} ticket(s) completed — escalation strikes {prev} -> {self.escalations}")

            if rc == PipelineResult.PASS:
                log("######## supervisor: backlog complete — all tickets done ########")
                return PipelineResult.PASS

            # backlog() only ever yields PASS or ESCALATE; any non-PASS means
            # the harness itself failed and needs claude/human repair.
            self.escalations += 1
            if self.escalations > self.max_escalations:
                log(f"######## supervisor: {self.max_escalations} escalations exhausted — STOPPING, needs a human ########")
                return PipelineResult.ESCALATE
            log(f">>> ESCALATION {self.escalations}/{self.max_escalations}: asking claude to diagnose & repair")
            diag_dir = Path(self.workspace.root) / "harness"
            repair_pass(self.roster.role("repair"),
                         workspace=self.workspace, suplog=self.suplog,
                         escalation=self.escalations, artifacts_dir=diag_dir,
                         telemetry=self.telemetry)
            log(">>> diagnosis complete — restarting loop")
            time.sleep(5)


__all__ = ["Supervisor"]
