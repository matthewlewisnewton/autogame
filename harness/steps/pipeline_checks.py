"""background_vitest — split server + client vitest run in a thread."""
from __future__ import annotations

import json
import subprocess
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from harness.config.tunables import PipelineTunables
from harness.telemetry.logging import log
from harness.telemetry.progress import emit_progress_event


@dataclass
class PipelineHandle:
    thread: threading.Thread
    artifacts_dir: Path


def background_vitest(artifacts_dir: Path, tunables: PipelineTunables,
                      *, label: str = "subtask") -> Optional[PipelineHandle]:
    if not tunables.local_checks:
        return None
    artifacts_dir = Path(artifacts_dir)
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    out_path = artifacts_dir / "local-checks.log"
    emit_progress_event("pipeline_check_start", {
        "label": label, "artifacts": str(artifacts_dir),
        "cwd": tunables.check_cwd,
        "timeoutSeconds": tunables.server_timeout_s + tunables.client_timeout_s,
    })

    def _run():
        with out_path.open("wb") as out:
            out.write(f"[pipeline] cwd={tunables.check_cwd}\n".encode())
            out.flush()
            out.write(f"[pipeline] running server tests (timeout={tunables.server_timeout_s}s)...\n".encode())
            out.flush()
            try:
                server_rc = subprocess.run(
                    ["timeout", "-k", "30", str(tunables.server_timeout_s),
                     "npx", "vitest", "run", "--project", "server"],
                    cwd=tunables.check_cwd, stdin=subprocess.DEVNULL,
                    stdout=out, stderr=subprocess.STDOUT,
                ).returncode
            except FileNotFoundError as e:
                out.write(f"[pipeline] FAILED to spawn: {e}\n".encode())
                _write_status(artifacts_dir, rc=127, reason="spawn_failed")
                return
            if server_rc != 0:
                out.write(f"[pipeline] server tests failed (rc={server_rc})\n".encode())
                _write_status(artifacts_dir, rc=server_rc, reason=f"server_rc_{server_rc}")
                return
            out.write(f"[pipeline] running client tests (timeout={tunables.client_timeout_s}s)...\n".encode())
            out.flush()
            client_rc = subprocess.run(
                ["timeout", "-k", "30", str(tunables.client_timeout_s),
                 "npx", "vitest", "run", "--project", "client"],
                cwd=tunables.check_cwd, stdin=subprocess.DEVNULL,
                stdout=out, stderr=subprocess.STDOUT,
            ).returncode
            if client_rc != 0:
                out.write(f"[pipeline] client tests failed (rc={client_rc})\n".encode())
                _write_status(artifacts_dir, rc=client_rc, reason=f"client_rc_{client_rc}")
                return
            out.write(b"[pipeline] all tests passed\n")
            _write_status(artifacts_dir, rc=0, reason="ok")

    t = threading.Thread(target=_run, name=f"vitest-{label}", daemon=True)
    t.start()
    return PipelineHandle(thread=t, artifacts_dir=artifacts_dir)


def finish_background_vitest(handle: Optional[PipelineHandle],
                             *, label: str = "subtask") -> int:
    if handle is None:
        return 0
    log("[pipeline] waiting for local verification...")
    handle.thread.join()
    status = _read_status(handle.artifacts_dir)
    rc = status.get("rc", 1) if status else 1
    reason = status.get("reason", "unknown") if status else "no_status_file"
    if rc == 0:
        log("[pipeline] local verification passed")
    else:
        log(f"[pipeline] local verification finished non-zero (rc={rc}, reason={reason})")
    emit_progress_event("pipeline_check_finish", {
        "label": label, "artifacts": str(handle.artifacts_dir),
        "outfile": str(handle.artifacts_dir / "local-checks.log"),
        "rc": rc, "reason": reason,
    })
    return rc


def _write_status(artifacts_dir: Path, *, rc: int, reason: str) -> None:
    try:
        (artifacts_dir / "local-checks.status.json").write_text(
            json.dumps({"rc": rc, "reason": reason}) + "\n"
        )
    except OSError:
        pass


def _read_status(artifacts_dir: Path) -> Optional[dict]:
    try:
        return json.loads((artifacts_dir / "local-checks.status.json").read_text())
    except (OSError, json.JSONDecodeError):
        return None


__all__ = ["PipelineHandle", "background_vitest", "finish_background_vitest"]
