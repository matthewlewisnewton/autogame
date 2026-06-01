"""record_agent_usage + TelemetrySink. Ports lib.sh::record_agent_usage (lib.sh:419)."""
from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Optional

from harness.agents.base import AgentResult, UsageKind

_WRITE_LOCK = threading.Lock()


def _usage_path() -> Path:
    # Shares progress_dir() so parallel workers (in worktrees) record usage to
    # the main checkout's progress dir via HARNESS_PROGRESS_DIR, not their own.
    from harness.telemetry.progress import progress_dir
    return progress_dir() / "agent-usage.ndjson"


class TelemetrySink:
    """Concrete telemetry hook used by spawn() + Role.execute callers."""

    def agent_start(self, *, label: str, outfile: str, attempt: int,
                    timeout_s: float) -> None:
        from harness.telemetry.progress import emit_progress_event
        emit_progress_event("agent_start", {
            "agent": label, "outfile": outfile,
            "attempt": attempt, "timeoutSeconds": timeout_s,
        })

    def agent_retry(self, *, label: str, outfile: str, attempt: int,
                    rc: int, reason: str) -> None:
        from harness.telemetry.progress import emit_progress_event
        emit_progress_event("agent_retry", {
            "agent": label, "outfile": outfile,
            "attempt": attempt, "rc": rc, "reason": reason,
        })

    def agent_finish(self, *, label: str, outfile: str, attempt: int,
                     rc: int, status: str, reason: Optional[str] = None) -> None:
        from harness.telemetry.progress import emit_progress_event
        payload = {"agent": label, "outfile": outfile, "attempt": attempt,
                   "rc": rc, "status": status}
        if reason is not None:
            payload["reason"] = reason
        emit_progress_event("agent_finish", payload)

    def emit(self, event_type: str, payload: dict) -> None:
        from harness.telemetry.progress import emit_progress_event
        emit_progress_event(event_type, payload)

    def record_agent_usage(self, *, label: str, result: AgentResult,
                           attempt: int, usage_kind: UsageKind, bucket: str,
                           prompt: str, status: str = "ok") -> None:
        record_agent_usage(label=label, result=result, attempt=attempt,
                            usage_kind=usage_kind, bucket=bucket,
                            prompt=prompt, status=status)


def record_agent_usage(*, label: str, result: AgentResult, attempt: int,
                       usage_kind: UsageKind, bucket: str, prompt: str,
                       status: str = "ok") -> None:
    row = {
        "label": label,
        "model": label.split("/", 1)[1] if "/" in label else label,
        "bucket": bucket,
        "usage_kind": usage_kind.value if isinstance(usage_kind, UsageKind) else str(usage_kind),
        "attempt": attempt,
        "rc": result.rc,
        "exit_code": result.exit_code,
        "reason": result.reason.value,
        "status": status,
        "started_ms": int(result.started_at * 1000),
        "ended_ms": int(result.ended_at * 1000),
        "duration_s": result.duration_s,
        "prompt_len": len(prompt or ""),
        "input_tokens": result.input_tokens,
        "output_tokens": result.output_tokens,
        "cost_usd": result.cost_usd,
    }
    from harness.telemetry.progress import locked_append
    try:
        locked_append(_usage_path(), json.dumps(row))
    except OSError:
        pass


__all__ = ["TelemetrySink", "record_agent_usage"]
