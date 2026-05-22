"""finalize — port of run_ticket.sh::finalize (run_ticket.sh:220-247).

Returns FinalizeResult so ticket() distinguishes SUCCESS / GAME_BROKEN /
COMMIT_FAILED per design doc §8.2.
"""
from __future__ import annotations

import re
import time
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import TYPE_CHECKING

from harness.git_helpers import commit_verified, next_version_tag
from harness.steps.confirm_broken import confirm_game_broken, game_smoke_ok
from harness.steps.ingest_nits import ingest_nits
from harness.telemetry.logging import log

if TYPE_CHECKING:
    from harness.workspace.ports import PortAllocation


class FinalizeResult(Enum):
    SUCCESS       = "success"
    GAME_BROKEN   = "game_broken"
    COMMIT_FAILED = "commit_failed"


def finalize(*, workspace, ticket_name: str, ticket_file: Path,
             artifacts_dir: Path, review_file: Path, ticket_dir: Path,
             include_harness: bool = False, game_url: str = "http://localhost:5173",
             ports: "PortAllocation | None" = None, telemetry=None) -> FinalizeResult:
    artifacts_dir = Path(artifacts_dir)
    ticket_dir = Path(ticket_dir)

    if not game_smoke_ok(artifacts_dir):
        confirm_dir = ticket_dir / f"finalize-confirm-smoke-{int(time.time())}"
        from harness.workspace.ports import default_ports
        ports_used = ports or default_ports()
        if confirm_game_broken(artifacts_dir, confirm_dir,
                                game_url=game_url, ports=ports_used):
            log("[finalize] review reported PASS but confirmed game health failed — NOT completing")
            return FinalizeResult.GAME_BROKEN
        log("[finalize] review PASS accepted after confirmation smoke cleared a transient health failure")

    tag = next_version_tag(workspace)
    log(f"[review] PASS — finalizing as {tag}")

    root = Path(workspace.root)
    tasks_md = root / "TASKS.md"
    if tasks_md.exists():
        text = tasks_md.read_text()
        new_text = re.sub(
            r"^- \[ \] \[" + re.escape(ticket_name) + r"\]",
            f"- [x] [{ticket_name}]",
            text, flags=re.MULTILINE,
        )
        tasks_md.write_text(new_text)

    logbook = root / "LOGBOOK.md"
    title_line = ticket_file.read_text().splitlines()[0] if ticket_file.exists() else ticket_name
    title = re.sub(r"^#\s*", "", title_line).strip()
    timestamp = datetime.now().strftime("%F %T")
    review_tail = ""
    if review_file.exists():
        lines = review_file.read_text().splitlines()
        filtered = [ln for ln in lines if not ln.startswith("VERDICT:")][-20:]
        review_tail = "\n".join(filtered)
    with logbook.open("a", encoding="utf-8") as f:
        f.write(f"\n## {tag} — {title}  ({timestamp})\n\n")
        f.write(review_tail + "\n")

    nits_file = artifacts_dir / "nits.md"
    if nits_file.exists():
        ingest_nits(nits_file, ticket_name=ticket_name, workspace=workspace)

    if not commit_verified(workspace,
                            f"{ticket_name}: top-level ticket complete ({tag})",
                            include_harness=include_harness, telemetry=telemetry):
        log("=== ABORT: could not commit completed ticket — escalating ===")
        return FinalizeResult.COMMIT_FAILED

    try:
        workspace.tag(tag)
    except Exception as e:
        log(f"[finalize] warning: tag {tag} failed: {e}")

    log(f"########## {ticket_name} COMPLETE — tagged {tag} ##########")
    return FinalizeResult.SUCCESS


__all__ = ["FinalizeResult", "finalize"]
