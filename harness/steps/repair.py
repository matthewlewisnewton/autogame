"""repair_pass — supervisor's escalate-to-claude on rc=2.
Port of supervisor.sh:61-65."""
from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

from harness.telemetry.logging import log

if TYPE_CHECKING:
    from harness.roles import ChainResult, Role


def repair_pass(role: "Role", *, workspace, suplog: Path,
                escalation: int, artifacts_dir: Path,
                telemetry=None) -> "ChainResult":
    log(f"[repair] escalation {escalation}: claude diagnose-and-repair...")
    artifacts_dir = Path(artifacts_dir)
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    return role.execute(
        workspace=workspace,
        prompt_vars={"LOOPLOG": str(suplog)},
        artifacts_dir=artifacts_dir,
        telemetry=telemetry,
    )


__all__ = ["repair_pass"]
