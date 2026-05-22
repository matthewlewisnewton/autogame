"""ensure_handoff — synthesize handoff.md if implementer left none.
Content-hash compare (v2-v5 fix; bash mtime was second-precision).
"""
from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Optional

from harness.agents.base import AgentResult
from harness.agents.spawn import output_is_only_error
from harness.telemetry.logging import log


def sha256_of(path: Path) -> Optional[str]:
    if not path.exists():
        return None
    h = hashlib.sha256()
    try:
        with path.open("rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                h.update(chunk)
    except OSError:
        return None
    return h.hexdigest()


def ensure_handoff(handoff: Path, *, before_hash: Optional[str],
                   attempt: int, coder_result: AgentResult, coder_out: Path) -> None:
    """Synthesize handoff.md if content didn't change vs before_hash."""
    current_hash = sha256_of(handoff)
    if current_hash is not None and current_hash != before_hash:
        return
    log("[handoff] no handoff left by implementer — harness synthesizing one")
    reason = coder_result.reason.value if coder_result else "unknown"
    handoff.parent.mkdir(parents=True, exist_ok=True)
    parts = [
        f"## Harness fallback handoff — attempt {attempt} did not finish cleanly\n\n",
        f"The previous attempt left no handoff note. Harness classification: `{reason}`.\n",
        "Inspect the working tree under `game/` for partial changes and continue\n",
        "this sub-ticket from there.\n\n",
        "Tail of the previous attempt log:\n\n```\n",
    ]
    if coder_out.exists():
        text = coder_out.read_text(errors="replace")
        if output_is_only_error(text):
            parts.append("[model/tool error only — no useful implementation handoff was produced]\n")
        else:
            tail = text.splitlines()[-40:]
            parts.append("\n".join(tail) + "\n")
    parts.append("\n```\n")
    handoff.write_text("".join(parts))


def scope_conflict_sentinel_in(handoff: Path) -> bool:
    """Detect the implementer's SCOPE-CONFLICT marker (doc Q11)."""
    if not handoff.exists():
        return False
    try:
        return "<!-- HARNESS:SCOPE-CONFLICT -->" in handoff.read_text()
    except OSError:
        return False


__all__ = ["ensure_handoff", "scope_conflict_sentinel_in", "sha256_of"]
