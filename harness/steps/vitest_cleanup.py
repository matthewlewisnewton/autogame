"""Spawn and tear down vitest without leaving orphaned worker processes.

When a vitest parent is SIGKILL'd (agent timeout, harness `timeout -k`, etc.)
pool workers can be reparented to init and keep running. We run vitest in its
own session and kill the whole process group, then sweep any stragglers whose
cwd matches the game test directory.
"""
from __future__ import annotations

import os
import signal
import subprocess
import sys
import time
from pathlib import Path
from typing import BinaryIO, Optional, Sequence


def vitest_process_cwd(pid: int) -> Optional[Path]:
    """Return the process working directory, or None if unavailable."""
    if sys.platform == "darwin":
        try:
            result = subprocess.run(
                ["lsof", "-a", "-d", "cwd", "-p", str(pid), "-Fn"],
                capture_output=True,
                text=True,
                timeout=5,
                check=False,
            )
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return None
        for line in result.stdout.splitlines():
            if line.startswith("n"):
                return Path(line[1:])
        return None

    try:
        return Path(os.readlink(f"/proc/{pid}/cwd"))
    except OSError:
        return None


def kill_vitest_for_cwd(check_cwd: Path) -> int:
    """SIGKILL vitest-related processes whose cwd equals *check_cwd*."""
    check_cwd = check_cwd.resolve()
    killed = 0
    try:
        result = subprocess.run(
            ["pgrep", "-f", "vitest"],
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
    except FileNotFoundError:
        return 0

    for pid_str in result.stdout.split():
        try:
            pid = int(pid_str)
        except ValueError:
            continue
        cwd = vitest_process_cwd(pid)
        if cwd is None or cwd != check_cwd:
            continue
        try:
            os.kill(pid, signal.SIGKILL)
            killed += 1
        except ProcessLookupError:
            pass
    return killed


def _kill_process_group(pid: int) -> None:
    if pid <= 0:
        return
    try:
        pgid = os.getpgid(pid)
    except ProcessLookupError:
        return
    for sig in (signal.SIGTERM, signal.SIGKILL):
        try:
            os.killpg(pgid, sig)
        except ProcessLookupError:
            return
        except PermissionError:
            try:
                os.kill(pid, sig)
            except ProcessLookupError:
                return
        time.sleep(0.1)


def run_vitest(
    args: Sequence[str],
    *,
    cwd: Path,
    timeout_s: int,
    stdout: BinaryIO,
    kill_grace_s: int = 15,
) -> int:
    """Run ``npx vitest …`` in a dedicated session; always tear down workers."""
    cwd = Path(cwd)
    cmd = ["npx", "vitest", *args]
    leader = subprocess.Popen(
        cmd,
        cwd=cwd,
        stdin=subprocess.DEVNULL,
        stdout=stdout,
        stderr=subprocess.STDOUT,
        start_new_session=True,
    )
    deadline = time.monotonic() + timeout_s
    rc = 1
    try:
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                stdout.write(
                    f"[vitest] timed out after {timeout_s}s — killing process group\n".encode()
                )
                stdout.flush()
                _kill_process_group(leader.pid)
                try:
                    leader.wait(timeout=kill_grace_s)
                except subprocess.TimeoutExpired:
                    _kill_process_group(leader.pid)
                    try:
                        leader.wait(timeout=1)
                    except subprocess.TimeoutExpired:
                        pass
                rc = 124
                break
            try:
                rc = leader.wait(timeout=min(remaining, 1.0))
                break
            except subprocess.TimeoutExpired:
                continue
    finally:
        if leader.poll() is None:
            _kill_process_group(leader.pid)
            try:
                leader.wait(timeout=kill_grace_s)
            except subprocess.TimeoutExpired:
                pass
        kill_vitest_for_cwd(cwd)
    return rc


__all__ = ["kill_vitest_for_cwd", "run_vitest", "vitest_process_cwd"]
