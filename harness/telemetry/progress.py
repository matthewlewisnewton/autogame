"""emit_progress_event — ports lib.sh::emit_progress_event (lib.sh:76-101)."""
from __future__ import annotations

import datetime as _dt
import json
import os
import threading
import urllib.request
from pathlib import Path

try:
    import fcntl  # POSIX (Linux). Absent on Windows — degrade to thread lock only.
except ImportError:  # pragma: no cover
    fcntl = None  # type: ignore

_WRITE_LOCK = threading.Lock()


def locked_append(path: Path, line: str) -> None:
    """Append `line` + newline to `path` under an exclusive lock that holds
    ACROSS PROCESSES (fcntl.flock), not just threads. Parallel worker processes
    share one events/usage file via HARNESS_PROGRESS_DIR, and a plain
    threading.Lock gives them no mutual exclusion — interleaved appends can
    corrupt lines. flock(LOCK_EX) serializes the append regardless of process."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with _WRITE_LOCK:  # cheap within-process guard
        with path.open("a", encoding="utf-8") as f:
            if fcntl is not None:
                try:
                    fcntl.flock(f.fileno(), fcntl.LOCK_EX)
                except OSError:
                    pass
            try:
                f.write(line + "\n")
                f.flush()
            finally:
                if fcntl is not None:
                    try:
                        fcntl.flock(f.fileno(), fcntl.LOCK_UN)
                    except OSError:
                        pass


def progress_dir() -> Path:
    """The progress dir. Parallel workers run in their own git worktree, where
    the module-relative path would point at the worktree's own copy and
    fragment the live view. HARNESS_PROGRESS_DIR pins all workers to the main
    checkout's progress dir; unset ⇒ the historical module-relative path."""
    override = os.environ.get("HARNESS_PROGRESS_DIR")
    if override:
        return Path(override)
    return Path(__file__).resolve().parents[1] / "progress"


def _events_path() -> Path:
    return progress_dir() / "events.ndjson"


def emit_progress_event(event_type: str, payload: dict | None = None) -> None:
    if os.environ.get("PROGRESS_EVENTS", "1") == "0":
        return
    ts = _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    line = json.dumps({"ts": ts, "type": event_type, "payload": payload or {}})

    try:
        locked_append(_events_path(), line)
    except OSError:
        pass

    server_url = os.environ.get("PROGRESS_SERVER_URL")
    if server_url:
        try:
            req = urllib.request.Request(
                f"{server_url.rstrip('/')}/events",
                data=line.encode("utf-8"),
                headers={"content-type": "application/json"},
                method="POST",
            )
            urllib.request.urlopen(req, timeout=2)
        except Exception:
            pass


__all__ = ["emit_progress_event"]
