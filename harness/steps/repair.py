"""Unified recovery path.

Merges the two formerly-parallel claude-repair mechanisms:
  - the in-ticket `rescue` (rounds exhausted: finish the ticket + close gaps),
  - the supervisor-level `repair_pass` (rc=2 tool/harness failure: fix harness).

Both spawned a recovery agent against the live workspace and both could edit
`harness/**`, but only rescue committed — so the supervisor's harness fixes
evaporated on the next checkout. They are now one `run_repair()` using one role
(`repair`, model configured in roles.yaml), one prompt
(harness/prompts/repair.md, mode-gated), that ALWAYS commits on acceptance
(include_harness=True) so a harness fix persists. The two call sites differ only
in `mode` and the prompt_vars they pass.
"""
from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

from harness.git_helpers import commit_verified
from harness.telemetry.logging import log
from harness.telemetry.progress import emit_progress_event

if TYPE_CHECKING:
    from harness.roles import ChainResult, Role


def run_repair(role: "Role", *, workspace, mode: str, prompt_vars: dict,
               artifacts_dir: Path, commit_msg: str,
               telemetry=None) -> "ChainResult":
    """Run the recovery role and commit its work on acceptance.

    mode: "ticket" (finish a ticket) or "harness" (fix the harness). Only used
    for logging/telemetry — the prompt itself branches on the MODE var.

    Commit gate (preserved from the v4.2 rescue fix): commit ONLY when a tier
    actually accepted. A tool-failed / scope-violated chain (accepted_by is
    None) must not land a spurious commit before the caller escalates.
    """
    artifacts_dir = Path(artifacts_dir)
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    emit_progress_event("repair_start", {"mode": mode})
    log(f"[repair:{mode}] recovery pass...")
    chain = role.execute(
        workspace=workspace,
        prompt_vars=prompt_vars,
        artifacts_dir=artifacts_dir,
        telemetry=telemetry,
    )
    if chain.accepted_by is not None:
        # include_harness=True so a successful harness fix is committed (and
        # survives the next clean checkout). Game-only repairs stage harmlessly
        # since no harness paths changed.
        commit_verified(workspace, commit_msg, include_harness=True,
                        telemetry=telemetry)
    else:
        log(f"[repair:{mode}] chain exhausted without acceptance — skipping commit")
    return chain


__all__ = ["run_repair"]
