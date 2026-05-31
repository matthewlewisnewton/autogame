"""Supervisor — outermost watchdog. Ports supervisor.sh per design doc §8.4."""
from __future__ import annotations

import os
import signal
import sys
import time
import traceback
from pathlib import Path
from typing import Optional

from harness.pipelines.backlog import BacklogContext, backlog
from harness.pipelines.result import PipelineResult
from harness.roles import Roster
from harness.steps.repair import run_repair
from harness.telemetry import progress_server
from harness.telemetry.logging import log
from harness.telemetry.usage import TelemetrySink
from harness.workspace.repo import Repo


_REEXEC_ENV = "HARNESS_REEXEC_COUNT"


class Supervisor:
    def __init__(self, *, workspace: Repo,
                 roles_path: Path = Path("harness/roles.yaml"),
                 local_roles_path: Optional[Path] = Path("harness/roles.local.yaml"),
                 max_escalations: int = 3, max_reexecs: int = 3,
                 suplog: Path = Path("LOOPLOG.txt")):
        self.workspace = workspace
        self.roles_path = roles_path
        self.local_roles_path = local_roles_path if local_roles_path and local_roles_path.exists() else None
        self.max_escalations = max_escalations
        # A harness repair edits Python modules already imported into THIS
        # process; they only take effect after a fresh interpreter. So after a
        # committed harness repair the supervisor re-execs itself. _REEXEC_ENV
        # bounds consecutive re-execs (reset when a ticket completes) so a
        # repair that never actually fixes anything can't thrash forever.
        self.max_reexecs = max_reexecs
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

    def _reexec_to_load_repair(self) -> None:
        """Replace this process with a fresh `python -m harness supervisor` so a
        just-committed harness repair (Python modules already imported here)
        actually loads. Bounded by max_reexecs via _REEXEC_ENV so a repair that
        never fixes anything can't thrash. The progress server keeps running;
        the new process's start_if_needed() is idempotent and reattaches."""
        count = int(os.environ.get(_REEXEC_ENV, "0")) + 1
        if count > self.max_reexecs:
            log(f"######## supervisor: {self.max_reexecs} consecutive harness re-execs "
                f"without progress — STOPPING, needs a human ########")
            raise SystemExit(int(PipelineResult.ESCALATE))
        os.environ[_REEXEC_ENV] = str(count)
        log(f">>> re-exec {count}/{self.max_reexecs}: reloading harness to apply committed repair")
        os.execv(sys.executable, [sys.executable, "-m", "harness", "supervisor"])

    def run(self) -> int:
        self.roster = Roster.load(self.roles_path, self.local_roles_path)
        progress_server.start_if_needed()
        signal.signal(signal.SIGHUP, self._on_sighup)
        signal.signal(signal.SIGTERM, self._on_sigterm)
        log(f"######## supervisor started ({time.strftime('%F %T')}) ########")

        while True:
            tags_before = self._count_v0_tags()
            log(">>> launching backlog run")
            try:
                rc = backlog(BacklogContext(
                    workspace=self.workspace, roster=self.roster,
                    tunables=self.roster.tunables, telemetry=self.telemetry,
                ))
            except Exception:
                # An unhandled exception in the pipeline used to kill the whole
                # supervisor (observed 2026-05-31: a PermissionError in the
                # coverage step crashed the process, no escalation). Treat a
                # crash like any other harness failure — escalate to claude
                # repair (+ re-exec) instead of dying.
                log(">>> backlog run CRASHED with an unhandled exception:")
                log(traceback.format_exc())
                rc = PipelineResult.ESCALATE
            tags_after = self._count_v0_tags()
            log(f">>> backlog run exited rc={rc} (completed tickets: {tags_before} -> {tags_after})")

            # Escalation-decay (supervisor.sh:38-44). Progress also clears the
            # re-exec budget — a repair that unblocked real work earns a reset.
            completed = tags_after - tags_before
            if completed > 0:
                if self.escalations > 0:
                    prev = self.escalations
                    self.escalations = max(0, self.escalations - completed)
                    log(f">>> {completed} ticket(s) completed — escalation strikes {prev} -> {self.escalations}")
                os.environ[_REEXEC_ENV] = "0"

            if rc == PipelineResult.PASS:
                log("######## supervisor: backlog complete — all tickets done ########")
                return PipelineResult.PASS

            # backlog() only ever yields PASS or ESCALATE; any non-PASS means
            # the harness itself failed and needs claude/human repair.
            self.escalations += 1
            if self.escalations > self.max_escalations:
                log(f"######## supervisor: {self.max_escalations} escalations exhausted — STOPPING, needs a human ########")
                return PipelineResult.ESCALATE
            log(f">>> ESCALATION {self.escalations}/{self.max_escalations}: claude repairing the harness")
            chain = run_repair(
                self.roster.role("repair"), workspace=self.workspace,
                mode="harness",
                prompt_vars={
                    "MODE": "harness", "LOOPLOG": str(self.suplog),
                    "TICKET_FILE": "", "REVIEW_FB": "", "BASE_REF": "", "ROUNDS": "",
                },
                artifacts_dir=Path(self.workspace.root) / "harness" / "repair",
                commit_msg=f"harness: claude repair pass (escalation {self.escalations})",
                telemetry=self.telemetry)
            log(">>> repair complete — restarting loop")
            if chain.accepted_by is not None:
                # The committed fix lives in modules already imported here;
                # re-exec a fresh interpreter so it actually loads. Does not
                # return on success.
                self._reexec_to_load_repair()
            time.sleep(5)


__all__ = ["Supervisor"]
