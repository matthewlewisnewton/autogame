"""decompose — invoke the decomposer role for one ticket round."""
from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

from harness.telemetry.logging import log
from harness.telemetry.progress import emit_progress_event

if TYPE_CHECKING:
    from harness.roles import ChainResult, Role


def decompose(role: "Role", *, workspace, ticket_name: str, ticket_file: Path,
              subtickets_dir: Path, round_n: int, review_fb: Path,
              artifacts_dir: Path, telemetry=None) -> "ChainResult":
    """Run decomposer. extra_safe_paths includes the subtickets dir
    because the decomposer's job IS to write sub-ticket folders there
    (outside the artifacts dir)."""
    log(f"[decompose] round {round_n} for {ticket_name}...")
    emit_progress_event("decompose_start", {"ticket": ticket_name, "round": round_n})

    if round_n > 1 and review_fb.exists():
        remediation = (
            f"REMEDIATION ROUND {round_n}. Sub-ticket folders with a .passed "
            f"marker are already done — never modify them. The file {review_fb} "
            f"holds the CURRENT open gaps; it is rewritten every round, so it "
            f"fully supersedes anything from earlier rounds. It ends with a "
            f"pointer to the full review — open that read-only file if the "
            f"compact summary is not detailed enough, but never edit it or any "
            f"earlier review. Read the gaps and add ONLY new sub-tickets that "
            f"close those specific gaps."
        )
    else:
        remediation = ""

    try:
        subroot_rel = Path(subtickets_dir).resolve().relative_to(
            Path(workspace.root).resolve())
        extra_safe = [f"{subroot_rel}/**"]
    except (ValueError, AttributeError):
        extra_safe = []

    return role.execute(
        workspace=workspace,
        prompt_vars={
            "TICKET_FILE": str(ticket_file),
            "SUBTICKETS_DIR": str(subtickets_dir),
            "REMEDIATION": remediation,
        },
        artifacts_dir=artifacts_dir,
        telemetry=telemetry,
        extra_safe_paths=extra_safe,
    )


def list_subticket_dirs(subroot: Path) -> list[Path]:
    """Return sub-ticket dirs with ticket.md, sorted."""
    subroot = Path(subroot)
    if not subroot.is_dir():
        return []
    out = []
    for child in subroot.iterdir():
        if child.is_dir() and (child / "ticket.md").exists():
            out.append(child)
    return sorted(out, key=lambda p: p.name)


__all__ = ["decompose", "list_subticket_dirs"]
