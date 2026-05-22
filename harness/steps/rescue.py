"""rescue — claude implements remaining fixes after rounds exhausted.
Port of run_ticket.sh:517-545."""
from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

from harness.git_helpers import commit_verified
from harness.telemetry.logging import log
from harness.telemetry.progress import emit_progress_event

if TYPE_CHECKING:
    from harness.roles import ChainResult, Role


def rescue(role: "Role", *, workspace, ticket_name: str, ticket_file: Path,
           review_fb: Path, base_ref: str, max_rounds: int,
           rescue_dir: Path, telemetry=None) -> "ChainResult":
    rescue_dir = Path(rescue_dir)
    rescue_dir.mkdir(parents=True, exist_ok=True)
    emit_progress_event("rescue_start",
                        {"ticket": ticket_name, "maxRounds": max_rounds})
    try:
        diff_text = workspace.run_git("diff", f"{base_ref}..HEAD")
        (rescue_dir / "ticket.diff").write_text(diff_text + "\n")
    except Exception:
        (rescue_dir / "ticket.diff").write_text("")
    log("[rescue] claude implementing the remaining fixes directly...")
    chain = role.execute(
        workspace=workspace,
        prompt_vars={
            "TICKET_FILE": str(ticket_file),
            "REVIEW_FB": str(review_fb),
            "BASE_REF": base_ref,
            "ROUNDS": str(max_rounds),
        },
        artifacts_dir=rescue_dir,
        telemetry=telemetry,
    )
    commit_verified(workspace, f"{ticket_name}: claude rescue implementation pass",
                    telemetry=telemetry)
    return chain


__all__ = ["rescue"]
