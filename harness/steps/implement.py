"""implement — thin wrapper calling the implementer role."""
from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

from harness.telemetry.logging import log

if TYPE_CHECKING:
    from harness.roles import ChainResult, Role


def implement(role: "Role", *, workspace, ticket_file: Path, feedback: Path,
              handoff: Path, artifacts_dir: Path, telemetry=None) -> "ChainResult":
    log("[impl] implementing...")
    return role.execute(
        workspace=workspace,
        prompt_vars={
            "TICKET_FILE": str(ticket_file),
            "FEEDBACK_FILE": str(feedback),
            "HANDOFF_FILE": str(handoff),
        },
        artifacts_dir=artifacts_dir,
        telemetry=telemetry,
    )


__all__ = ["implement"]
