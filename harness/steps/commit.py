"""commit_with_role — invoke committer role + deterministic fallback."""
from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

from harness.git_helpers import commit_verified
from harness.telemetry.logging import log

if TYPE_CHECKING:
    from harness.roles import Role


def commit_with_role(role: "Role", *, workspace, ticket_file: Path, label: str,
                     fallback_message: str, artifacts_dir: Path,
                     include_harness: bool = False, telemetry=None) -> bool:
    """Run committer role; deterministic fallback via commit_verified.
    Returns True iff a commit landed (or none needed)."""
    head_before = workspace.head()
    role.execute(
        workspace=workspace,
        prompt_vars={"TICKET_FILE": str(ticket_file), "LABEL": label},
        artifacts_dir=artifacts_dir,
        telemetry=telemetry,
    )
    if workspace.head() != head_before:
        log(f"[commit] role committed: {workspace.head_short()}")
        return True
    if not commit_verified(workspace, fallback_message,
                           include_harness=include_harness, telemetry=telemetry):
        log("[commit] commit_verified failed — escalating")
        return False
    if workspace.head() != head_before:
        log(f"[commit] {workspace.head_short()}: {fallback_message}")
    else:
        log("[commit] no new changes — verified state already in HEAD")
    return True


__all__ = ["commit_with_role"]
