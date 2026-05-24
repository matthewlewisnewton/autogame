"""start_game / stop_game / wait_for_game / port helpers.

**Ticket 105 fix baked in**: tracks PIDs created by start_game(),
filters by command line before kill-by-port, opt-in
HARNESS_BROAD_PORT_KILL=1 falls back to bash behavior.
"""
from __future__ import annotations

import os
import re
import socket
import subprocess
import time
import urllib.error
import urllib.request
from contextlib import closing
from pathlib import Path

from harness.telemetry.logging import log
from harness.telemetry.progress import emit_progress_event
from harness.workspace.ports import PortAllocation


_HARNESS_GAME_PATTERNS = (
    re.compile(r"\bnode\s+game/server/index(\.js)?(\s|$)"),
    re.compile(r"\bvite\s+--port\s+5173(\s|$)"),
)


_GAME_PIDS: list[int] = []


def _port_holders(port: int) -> list[tuple[int, str]]:
    try:
        result = subprocess.run(
            ["ss", "-tlnp", f"sport = :{port}"],
            capture_output=True, text=True, timeout=5,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return []
    pids: list[tuple[int, str]] = []
    for line in result.stdout.splitlines():
        for m in re.finditer(r'pid=(\d+)', line):
            pid = int(m.group(1))
            pids.append((pid, _pid_cmdline(pid)))
    return pids


def _pid_cmdline(pid: int) -> str:
    try:
        with open(f"/proc/{pid}/cmdline", "rb") as f:
            return f.read().replace(b"\0", b" ").decode("utf-8", errors="replace").strip()
    except OSError:
        return ""


def _is_harness_game_proc(cmdline: str) -> bool:
    return any(p.search(cmdline) for p in _HARNESS_GAME_PATTERNS)


def port_in_use(port: int) -> bool:
    with closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as s:
        try:
            s.bind(("127.0.0.1", port))
            return False
        except OSError:
            return True


def wait_port_free(port: int, timeout_s: int = 15) -> bool:
    """Block until the port is no longer bound. Per ticket 105: only kill
    harness-owned holders unless HARNESS_BROAD_PORT_KILL=1."""
    deadline = time.time() + timeout_s
    broad = os.environ.get("HARNESS_BROAD_PORT_KILL") == "1"
    while time.time() < deadline:
        if not port_in_use(port):
            return True
        for pid, cmdline in _port_holders(port):
            if _is_harness_game_proc(cmdline) or broad:
                _kill_pid(pid, signal_num=9)
            else:
                log(f"[port] :{port} held by pid {pid} ({cmdline[:60]!r}) — "
                    f"not a harness game proc, leaving it. Set HARNESS_BROAD_PORT_KILL=1 to force.")
        time.sleep(0.2)
    return False


def _kill_pid(pid: int, signal_num: int = 9) -> None:
    try:
        os.kill(pid, signal_num)
    except (ProcessLookupError, PermissionError):
        pass


def start_game(logdir: Path, ports: PortAllocation, *, max_vite_retries: int = 3) -> None:
    """Launch dev servers (server + vite). Per ticket 105 the pre-launch
    cleanup only kills harness-owned holders by default."""
    logdir = Path(logdir)
    logdir.mkdir(parents=True, exist_ok=True)
    emit_progress_event("game_start", {"logdir": str(logdir)})

    for port in (ports.vite, ports.game_server):
        if not wait_port_free(port, timeout_s=15):
            log(f"[warn] port {port} still bound after 15s")

    server_log = (logdir / "server.log").open("wb")
    server_proc = subprocess.Popen(
        ["node", "game/server/index.js"],
        stdin=subprocess.DEVNULL, stdout=server_log, stderr=subprocess.STDOUT,
        start_new_session=True,
    )
    _GAME_PIDS.append(server_proc.pid)

    client_log_path = logdir / "client.log"
    for attempt in range(1, max_vite_retries + 1):
        client_log = client_log_path.open("wb")
        client_proc = subprocess.Popen(
            ["npx", "vite", "--port", str(ports.vite), "--strictPort"],
            cwd="game/client",
            stdin=subprocess.DEVNULL, stdout=client_log, stderr=subprocess.STDOUT,
            start_new_session=True,
        )
        _GAME_PIDS.append(client_proc.pid)
        time.sleep(3)
        try:
            text = client_log_path.read_text(errors="replace")
        except OSError:
            text = ""
        if "EADDRINUSE" in text or "already in use" in text:
            log(f"[warn] Vite EADDRINUSE on attempt {attempt} — retrying after cleanup")
            _kill_pid(client_proc.pid)
            _GAME_PIDS.pop()
            wait_port_free(ports.vite, timeout_s=10)
            continue
        return
    log(f"[error] Vite failed to start after {max_vite_retries} attempts")


def stop_game() -> None:
    emit_progress_event("game_stop", {})
    for pid in _GAME_PIDS:
        _kill_pid(pid, signal_num=15)
    _GAME_PIDS.clear()
    for pat in (r"(^|[^[:alnum:]_])node[[:space:]]+game/server/index\.js([[:space:]]|$)",
                r"(^|[^[:alnum:]_])vite[[:space:]]+--port[[:space:]]+5173([[:space:]]|$)"):
        try:
            subprocess.run(["pkill", "-f", pat], stdout=subprocess.DEVNULL,
                           stderr=subprocess.DEVNULL, timeout=5)
        except (FileNotFoundError, subprocess.TimeoutExpired):
            pass
    time.sleep(1)


def wait_for_game(ports: PortAllocation, timeout_s: int = 45) -> bool:
    deadline = time.time() + timeout_s
    up_client = up_server = False
    while time.time() < deadline:
        if not up_client and _http_ok(f"http://localhost:{ports.vite}/"):
            up_client = True
        if not up_server and _http_ok(f"http://localhost:{ports.game_server}/healthz"):
            up_server = True
        if up_client and up_server:
            return True
        time.sleep(1)
    return False


def _http_ok(url: str) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=1) as resp:
            return 200 <= resp.status < 400
    except (urllib.error.URLError, urllib.error.HTTPError, OSError):
        return False


__all__ = ["port_in_use", "wait_port_free", "start_game", "stop_game", "wait_for_game"]
