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
import sys
import time
import urllib.error
import urllib.request
from contextlib import closing
from pathlib import Path

from harness.telemetry.logging import log
from harness.telemetry.progress import emit_progress_event
from harness.workspace.ports import PortAllocation


# Match the game server and the vite dev server by their real cmdlines.
# `npx vite` does not stay `vite` on disk: depending on the npm/node version
# it resolves either to the `.bin/vite` shim (`.../.bin/vite --port 5173`) or
# straight to the script (`.../vite/bin/vite.js --port 5173 --strictPort`).
# The vite pattern therefore tolerates an optional `.js` suffix and arbitrary
# args between the binary name and `--port 5173`.
# The server cmdline is `node game/server/index.js` when start_game launches
# it from the repo root, but a leftover holder from a run that used cwd=game/
# shows up as the relative `node server/index.js` (no `game/` prefix). The
# original pattern hard-required `game/server/index`, so it failed to recognise
# that leftover as a harness proc — wait_port_free then refused to kill it and
# the new server died with EADDRINUSE on :3000. Make the leading path (incl.
# the `game/` segment) optional so both forms match.
_SERVER_PATTERN = re.compile(r"\bnode\s+\S*\bserver/index(\.js)?(\s|$)")


def _vite_pattern(vite_port: int) -> "re.Pattern":
    # Port-specific so a worker reclaims only ITS own vite, never a sibling
    # parallel worker's vite bound to a different port.
    return re.compile(rf"\bvite(\.js)?\b[^\n]*?--port\s+{vite_port}(\s|$)")


_GAME_PIDS: list[int] = []


def _port_holders(port: int) -> list[tuple[int, str]]:
    if sys.platform == "darwin":
        return _port_holders_darwin(port)
    if sys.platform.startswith("linux"):
        return _port_holders_linux(port)
    holders = _port_holders_darwin(port)
    return holders or _port_holders_linux(port)


def _port_holders_linux(port: int) -> list[tuple[int, str]]:
    try:
        result = subprocess.run(
            ["ss", "-tlnp", f"sport = :{port}"],
            capture_output=True, text=True, timeout=5,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return []
    pids: list[tuple[int, str]] = []
    seen: set[int] = set()
    for line in result.stdout.splitlines():
        for m in re.finditer(r"pid=(\d+)", line):
            pid = int(m.group(1))
            if pid in seen:
                continue
            seen.add(pid)
            pids.append((pid, _pid_cmdline(pid)))
    return pids


def _port_holders_darwin(port: int) -> list[tuple[int, str]]:
    try:
        result = subprocess.run(
            ["lsof", "-nP", f"-iTCP:{port}", "-sTCP:LISTEN", "-t"],
            capture_output=True, text=True, timeout=5,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return []
    pids: list[tuple[int, str]] = []
    seen: set[int] = set()
    for line in result.stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            pid = int(line)
        except ValueError:
            continue
        if pid in seen:
            continue
        seen.add(pid)
        pids.append((pid, _pid_cmdline(pid)))
    return pids


def _pid_cmdline(pid: int) -> str:
    if sys.platform == "darwin":
        return _pid_cmdline_darwin(pid)
    if sys.platform.startswith("linux"):
        return _pid_cmdline_linux(pid)
    cmdline = _pid_cmdline_darwin(pid)
    return cmdline or _pid_cmdline_linux(pid)


def _pid_cmdline_linux(pid: int) -> str:
    try:
        with open(f"/proc/{pid}/cmdline", "rb") as f:
            return f.read().replace(b"\0", b" ").decode("utf-8", errors="replace").strip()
    except OSError:
        return ""


def _pid_cmdline_darwin(pid: int) -> str:
    try:
        result = subprocess.run(
            ["ps", "-p", str(pid), "-o", "args="],
            capture_output=True, text=True, timeout=5,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return ""
    if result.returncode != 0:
        return ""
    return result.stdout.strip()


def _is_harness_game_proc(cmdline: str, vite_port: int = 5173) -> bool:
    # vite_port defaults to 5173 for the serial path + existing regression tests.
    return bool(_SERVER_PATTERN.search(cmdline)
                or _vite_pattern(vite_port).search(cmdline))


def port_in_use(port: int) -> bool:
    with closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as s:
        try:
            s.bind(("127.0.0.1", port))
            return False
        except OSError:
            return True


def wait_port_free(port: int, timeout_s: int = 15, *, vite_port: int = 5173) -> bool:
    """Block until the port is no longer bound. Per ticket 105: only kill
    harness-owned holders unless HARNESS_BROAD_PORT_KILL=1. vite_port lets a
    parallel worker recognise its own vite (on a non-default port) as
    harness-owned."""
    deadline = time.time() + timeout_s
    broad = os.environ.get("HARNESS_BROAD_PORT_KILL") == "1"
    while time.time() < deadline:
        if not port_in_use(port):
            return True
        for pid, cmdline in _port_holders(port):
            if _is_harness_game_proc(cmdline, vite_port) or broad:
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


def _kill_proc_group(pid: int, signal_num: int = 15) -> None:
    """Kill the whole process group led by ``pid``.

    start_game launches each server with ``start_new_session=True``, so the
    tracked pid is its group leader. Signalling only the leader leaks children
    (notably ``npx``'s ``vite.js`` child, which does not get the forwarded
    signal and keeps holding the port). Fall back to a plain pid kill if the
    group lookup fails.
    """
    try:
        os.killpg(os.getpgid(pid), signal_num)
    except (ProcessLookupError, PermissionError, OSError):
        _kill_pid(pid, signal_num)


def start_game(logdir: Path, ports: PortAllocation, *, max_vite_retries: int = 3) -> None:
    """Launch dev servers (server + vite). Per ticket 105 the pre-launch
    cleanup only kills harness-owned holders by default."""
    logdir = Path(logdir)
    logdir.mkdir(parents=True, exist_ok=True)
    # protect_review chmods round-N artifact dirs a-w after a previous
    # round commits, so a fresh round reusing the same logdir crashes here
    # with PermissionError on (logdir/'server.log').open('wb'). Delete any
    # stale logs (transient, harness-only artifacts) before re-opening.
    for name in ("server.log", "client.log"):
        p = logdir / name
        try:
            p.chmod(0o644)
        except (FileNotFoundError, PermissionError, OSError):
            pass
        try:
            p.unlink()
        except (FileNotFoundError, PermissionError, OSError):
            pass
    emit_progress_event("game_start", {"logdir": str(logdir)})

    for port in (ports.vite, ports.game_server):
        if not wait_port_free(port, timeout_s=15, vite_port=ports.vite):
            log(f"[warn] port {port} still bound after 15s")

    server_log = (logdir / "server.log").open("wb")
    server_proc = subprocess.Popen(
        ["node", "game/server/index.js"],
        env={**os.environ, "PORT": str(ports.game_server)},
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
            # Kill the whole npx/sh/vite.js group, not just the leader: signalling
            # only the npx leader leaks the vite.js child, which keeps holding the
            # port and re-triggers EADDRINUSE on the next attempt.
            _kill_proc_group(client_proc.pid, signal_num=9)
            _GAME_PIDS.pop()
            wait_port_free(ports.vite, timeout_s=10)
            continue
        return
    log(f"[error] Vite failed to start after {max_vite_retries} attempts")


def stop_game() -> None:
    emit_progress_event("game_stop", {})
    for pid in _GAME_PIDS:
        _kill_proc_group(pid, signal_num=15)
    _GAME_PIDS.clear()
    for pat in (r"node[[:space:]]+[^[:space:]]*server/index\.js([[:space:]]|$)",
                r"vite(\.js)?[[:space:]].*--port[[:space:]]+5173([[:space:]]|$)"):
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
        # The server "up" signal is "it answers HTTP at all", not a 2xx on a
        # specific route. The game server used to expose `/healthz` (returning
        # 200), but commit f9668ea removed that route, so `/healthz` now 404s
        # even when the server is fully booted ("Server listening on port
        # 3000"). The old 2xx-only check therefore never saw the server as up
        # and wait_for_game timed out, escalating a perfectly healthy run as an
        # infra failure. Any HTTP response (including a 404) proves the port is
        # bound and Express is serving requests, so treat that as up and stay
        # robust to the route coming and going in game code.
        if not up_server and _http_responding(f"http://localhost:{ports.game_server}/healthz"):
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


def _http_responding(url: str) -> bool:
    """True if the server returns ANY HTTP response — even a 404. A response
    means the port is bound and the app is serving requests (it's up). Only a
    connection-level failure (URLError/OSError without an HTTP response, e.g.
    connection refused) counts as not-up."""
    try:
        with urllib.request.urlopen(url, timeout=1) as resp:
            return resp.status is not None
    except urllib.error.HTTPError:
        return True
    except (urllib.error.URLError, OSError):
        return False


__all__ = ["port_in_use", "wait_port_free", "start_game", "stop_game", "wait_for_game"]
