"""progress_server lifecycle wrapper for harness/progress/server.mjs."""
from __future__ import annotations

import os
import signal
import socket
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

_DEFAULT_PORT = int(os.environ.get("PROGRESS_PORT", "3001"))
_PID_FILE = Path(__file__).resolve().parents[1] / "progress" / ".server.pid"


@dataclass
class ServerStatus:
    listening: bool
    port: int
    pid: Optional[int]


def _port_listening(port: int) -> bool:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.25)
            return s.connect_ex(("127.0.0.1", port)) == 0
    except OSError:
        return False


def status() -> ServerStatus:
    pid: Optional[int] = None
    if _PID_FILE.exists():
        try:
            pid = int(_PID_FILE.read_text().strip())
        except (OSError, ValueError):
            pid = None
    return ServerStatus(listening=_port_listening(_DEFAULT_PORT),
                        port=_DEFAULT_PORT, pid=pid)


def start_if_needed() -> ServerStatus:
    """Spawn `node harness/progress/server.mjs` if PROGRESS_PORT isn't
    already listening. Idempotent."""
    if _port_listening(_DEFAULT_PORT):
        return status()

    server_mjs = Path(__file__).resolve().parents[1] / "progress" / "server.mjs"
    if not server_mjs.exists():
        return ServerStatus(listening=False, port=_DEFAULT_PORT, pid=None)

    try:
        proc = subprocess.Popen(
            ["node", str(server_mjs)],
            cwd=str(server_mjs.parent),
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            stdin=subprocess.DEVNULL,
            start_new_session=True,
        )
    except (FileNotFoundError, OSError):
        return ServerStatus(listening=False, port=_DEFAULT_PORT, pid=None)

    deadline = time.time() + 2.0
    while time.time() < deadline:
        if _port_listening(_DEFAULT_PORT):
            try:
                _PID_FILE.parent.mkdir(parents=True, exist_ok=True)
                _PID_FILE.write_text(str(proc.pid))
            except OSError:
                pass
            break
        time.sleep(0.1)
    return status()


def stop() -> None:
    if not _PID_FILE.exists():
        return
    try:
        pid = int(_PID_FILE.read_text().strip())
    except (OSError, ValueError):
        return
    try:
        os.kill(pid, signal.SIGTERM)
    except (ProcessLookupError, PermissionError):
        pass
    try:
        _PID_FILE.unlink(missing_ok=True)
    except OSError:
        pass


__all__ = ["ServerStatus", "start_if_needed", "status", "stop"]
