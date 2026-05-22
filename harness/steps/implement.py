"""implement — thin wrapper calling the implementer role."""
from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

from harness.telemetry.logging import log

if TYPE_CHECKING:
    from harness.roles import ChainResult, Role


def implement(role: "Role", *, workspace, ticket_file: Path, feedback: Path,
              handoff: Path, artifacts_dir: Path, telemetry=None) -> "ChainResult":
    """Run the implementer role.

    Adds handoff.md to extra_safe_paths so the agent's write to handoff
    (one level above artifacts_dir) doesn't false-trip scope_audit. Per
    v5.1 hotfix — the implementer prompt explicitly directs the agent
    to (over)write handoff.md as its 'progress note'.
    """
    log("[impl] implementing...")
    try:
        handoff_rel = handoff.resolve().relative_to(Path(workspace.root).resolve())
        extra_safe = [str(handoff_rel)]
    except (ValueError, AttributeError):
        extra_safe = []
    return role.execute(
        workspace=workspace,
        prompt_vars={
            "TICKET_FILE": str(ticket_file),
            "FEEDBACK_FILE": str(feedback),
            "HANDOFF_FILE": str(handoff),
        },
        artifacts_dir=artifacts_dir,
        telemetry=telemetry,
        extra_safe_paths=extra_safe,
    )


__all__ = ["implement"]
