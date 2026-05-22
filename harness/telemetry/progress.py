"""emit_progress_event — ports lib.sh::emit_progress_event (lib.sh:76-101)."""
from __future__ import annotations

import datetime as _dt
import json
import os
import threading
import urllib.request
from pathlib import Path

_WRITE_LOCK = threading.Lock()


def _events_path() -> Path:
    return Path(__file__).resolve().parents[1] / "progress" / "events.ndjson"


def emit_progress_event(event_type: str, payload: dict | None = None) -> None:
    if os.environ.get("PROGRESS_EVENTS", "1") == "0":
        return
    ts = _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    line = json.dumps({"ts": ts, "type": event_type, "payload": payload or {}})

    path = _events_path()
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        with _WRITE_LOCK:
            need_leading_newline = False
            try:
                if path.exists() and path.stat().st_size > 0:
                    with path.open("rb") as f:
                        f.seek(-1, 2)
                        need_leading_newline = f.read(1) != b"\n"
            except OSError:
                pass
            with path.open("a", encoding="utf-8") as f:
                if need_leading_newline:
                    f.write("\n")
                f.write(line + "\n")
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
