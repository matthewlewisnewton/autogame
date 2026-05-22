"""accumulate_feedback — append filtered QA output to feedback.md."""
from __future__ import annotations

from pathlib import Path

from harness.prompts.noise_filter import filter_agent_feedback_noise


def accumulate_feedback(feedback: Path, *, iteration: int, qa_text: str) -> None:
    filtered = filter_agent_feedback_noise(qa_text or "")
    if not filtered.strip():
        return
    feedback.parent.mkdir(parents=True, exist_ok=True)
    block = (
        f"\n## Iteration {iteration} review\n\n"
        f"{filtered.rstrip()}\n"
    )
    with feedback.open("a", encoding="utf-8") as f:
        f.write(block)


__all__ = ["accumulate_feedback"]
