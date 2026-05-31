"""backlog() — port of run_backlog.sh per design doc §8.3."""
from __future__ import annotations

import re
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from harness.config.tunables import Tunables, get_tunables
from harness.pipelines.result import PipelineResult
from harness.pipelines.ticket import TicketContext, ticket
from harness.roles import Roster
from harness.telemetry.logging import log, tee_pipeline_log
from harness.workspace.repo import Repo


_UNCHECKED_RE = re.compile(r"^- \[ \] \[([^\]]+)\]", re.MULTILINE)


def next_open_ticket(workspace) -> Optional[str]:
    tasks_md = Path(workspace.root) / "TASKS.md"
    if not tasks_md.exists():
        return None
    m = _UNCHECKED_RE.search(tasks_md.read_text())
    return m.group(1) if m else None


@dataclass
class BacklogContext:
    workspace: Repo
    roster: Roster
    tunables: Tunables = field(default_factory=get_tunables)
    telemetry: object = None
    retry_sleep_s: int = 30


def backlog(ctx: BacklogContext) -> PipelineResult:
    """Backlog loop. Appends all output to LOOPLOG.txt at the repo root
    — matches bash supervisor.sh's `2>&1 | tee -a LOOPLOG.txt`. Each
    ticket() call has its own log.txt as well; LOOPLOG is the
    supervisor-level cumulative view."""
    log_path = Path(ctx.workspace.root) / "LOOPLOG.txt"
    with tee_pipeline_log(log_path):
        return _backlog_body(ctx)


def _backlog_body(ctx: BacklogContext) -> PipelineResult:
    """Returns PASS when the queue is drained, ESCALATE on a tool failure.
    INCOMPLETE and SPLIT are handled in-loop (retry / re-scan) and never
    propagate out."""
    completed = 0
    while True:
        name = next_open_ticket(ctx.workspace)
        if not name:
            log(f"=== backlog finished — {completed} ticket(s) completed; no unchecked tickets remain ===")
            return PipelineResult.PASS
        log(f">>> ticket: {name}")
        tdir = Path(ctx.workspace.root) / "tickets" / name
        rc = ticket(TicketContext(
            workspace=ctx.workspace, roster=ctx.roster, name=name, tdir=tdir,
            tunables=ctx.tunables, telemetry=ctx.telemetry,
        ))
        if rc == PipelineResult.PASS:
            completed += 1
            log(f">>> COMPLETE: {name}")
        elif rc == PipelineResult.ESCALATE:
            log(f">>> HARNESS/TOOL FAILURE on: {name} — stopping backlog for escalation")
            log(f"=== summary: {completed} ticket(s) completed before the tool failure ===")
            return PipelineResult.ESCALATE
        elif rc == PipelineResult.SPLIT:
            log(f">>> SPLIT: {name} restructured into smaller tickets — re-scanning backlog")
        else:  # INCOMPLETE
            log(f">>> INCOMPLETE: {name} — retrying; the backlog will not advance past an unsolved ticket")
            time.sleep(ctx.retry_sleep_s)


__all__ = ["BacklogContext", "backlog", "next_open_ticket"]
