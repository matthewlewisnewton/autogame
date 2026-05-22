"""optional_vision_feedback — port of run_subtask.sh:303-314."""
from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

from harness.telemetry.logging import log
from harness.telemetry.progress import emit_progress_event

if TYPE_CHECKING:
    from harness.roles import Role


def optional_vision_feedback(role: "Role", *, workspace, ticket_file: Path,
                             qa_file: Path, artifacts_dir: Path, game_url: str,
                             label: str, iteration: int, telemetry=None) -> None:
    log("[qwen-vision] enriching failed visual QA feedback...")
    result = role.execute(
        workspace=workspace,
        prompt_vars={
            "TICKET_FILE": str(ticket_file),
            "ARTIFACTS_DIR": str(artifacts_dir),
            "QA_FILE": str(qa_file),
            "GAME_URL": game_url,
        },
        artifacts_dir=artifacts_dir,
        telemetry=telemetry,
    )
    payload = {"label": label, "iteration": iteration,
               "outfile": str(artifacts_dir / "qwen-vision.txt")}
    if result.accepted_by is not None:
        log("[qwen-vision] feedback captured")
        payload["status"] = "captured"
    else:
        log("[qwen-vision] unavailable — continuing with original QA feedback")
        payload["status"] = "tool_failure"
    emit_progress_event("qwen_visual_feedback", payload)


__all__ = ["optional_vision_feedback"]
