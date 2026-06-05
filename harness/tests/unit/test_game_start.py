"""Unit tests for ``start_game`` in ``harness/steps/game.py``.

Covers the previously-uncovered launch path: log-dir setup, stale-log cleanup
(including read-only leftovers chmod'd a-w by protect_review), pre-launch port
freeing for both ports, server/vite launch with PID tracking, and the vite
EADDRINUSE retry loop.

The process/IO seams are monkeypatched so no real servers are launched and the
retry loop runs instantly:
  * ``game.subprocess.Popen`` -> a fake that records its call and (for vite)
    writes the desired ``client.log`` contents for that attempt.
  * ``game.time.sleep`` -> no-op (skip the real 3s settle wait).
  * ``game.wait_port_free`` -> records calls, returns True.
  * ``game._kill_proc_group`` -> records calls.
  * ``game.log`` -> captures emitted log lines.
"""
from __future__ import annotations

import os

import pytest

import harness.steps.game as game
from harness.workspace.ports import PortAllocation


# --------------------------------------------------------------------------- #
# Fakes / fixtures
# --------------------------------------------------------------------------- #
class FakeProc:
    """Minimal stand-in for ``subprocess.Popen`` exposing just ``.pid``."""

    def __init__(self, pid: int, args: list[str]) -> None:
        self.pid = pid
        self.args = args


class FakePopenFactory:
    """Callable drop-in for ``subprocess.Popen``.

    ``vite_logs`` is the sequence of strings written to ``client.log`` on
    successive *vite* launches (server launches never write). An exhausted
    sequence yields empty output (clean start).
    """

    def __init__(self, vite_logs: list[str] | None = None) -> None:
        self._vite_logs = iter(vite_logs or [])
        self._next_pid = iter(range(1000, 1_000_000))
        self.calls: list[dict] = []

    def __call__(self, args, **kwargs):
        pid = next(self._next_pid)
        self.calls.append({"args": list(args), "kwargs": kwargs, "pid": pid})
        if "vite" in args:
            content = next(self._vite_logs, "")
            stdout = kwargs.get("stdout")
            if stdout is not None and hasattr(stdout, "write"):
                stdout.write(content.encode())
                stdout.flush()
        return FakeProc(pid, list(args))

    # Convenience accessors -------------------------------------------------- #
    @property
    def server_calls(self) -> list[dict]:
        return [c for c in self.calls if "vite" not in c["args"]]

    @property
    def vite_calls(self) -> list[dict]:
        return [c for c in self.calls if "vite" in c["args"]]


@pytest.fixture
def isolate_pids():
    """Snapshot/restore ``game._GAME_PIDS`` so module state never leaks across
    tests, and start each test from an empty list."""
    snapshot = list(game._GAME_PIDS)
    game._GAME_PIDS.clear()
    try:
        yield game._GAME_PIDS
    finally:
        game._GAME_PIDS.clear()
        game._GAME_PIDS.extend(snapshot)


@pytest.fixture
def patched(monkeypatch: pytest.MonkeyPatch):
    """Install the common seams and return handles for assertions.

    Returns an object with:
      * ``port_calls``  -> list of (port, vite_port) passed to wait_port_free
      * ``kills``       -> list of (pid, signal_num) passed to _kill_proc_group
      * ``logs``        -> list of emitted log strings
      * ``set_popen(factory)`` -> install a FakePopenFactory
    """
    port_calls: list[tuple[int, int]] = []
    kills: list[tuple[int, int]] = []
    logs: list[str] = []

    def fake_wait_port_free(port, timeout_s=15, *, vite_port=5173):
        port_calls.append((port, vite_port))
        return True

    monkeypatch.setattr(game, "wait_port_free", fake_wait_port_free)
    monkeypatch.setattr(
        game, "_kill_proc_group",
        lambda pid, signal_num=15: kills.append((pid, signal_num)),
    )
    monkeypatch.setattr(game, "log", lambda msg: logs.append(msg))
    monkeypatch.setattr(game.time, "sleep", lambda _s: None)

    class Handles:
        def __init__(self) -> None:
            self.port_calls = port_calls
            self.kills = kills
            self.logs = logs
            self.popen: FakePopenFactory | None = None

        def set_popen(self, factory: FakePopenFactory) -> FakePopenFactory:
            monkeypatch.setattr(game.subprocess, "Popen", factory)
            self.popen = factory
            return factory

    return Handles()


PORTS = PortAllocation(game_server=3000, vite=5173)
PORTS_ALT = PortAllocation(game_server=3007, vite=5180)


# --------------------------------------------------------------------------- #
# Log-dir setup + stale-log cleanup
# --------------------------------------------------------------------------- #
class TestLogDirAndStaleCleanup:
    def test_creates_missing_logdir(self, tmp_path, patched, isolate_pids):
        patched.set_popen(FakePopenFactory([""]))  # clean vite start
        logdir = tmp_path / "logs" / "round-1"
        assert not logdir.exists()

        game.start_game(logdir, PORTS, max_vite_retries=2)

        assert logdir.is_dir()
        assert (logdir / "server.log").exists()
        assert (logdir / "client.log").exists()

    def test_removes_stale_read_only_logs_without_crashing(self, tmp_path, patched, isolate_pids):
        # Simulate protect_review having chmod'd the round dir's logs a-w: a
        # stale, read-only server.log/client.log must be cleared (chmod+unlink)
        # before re-opening, with no PermissionError crash.
        patched.set_popen(FakePopenFactory([""]))
        logdir = tmp_path / "logs"
        logdir.mkdir()
        stale_server = logdir / "server.log"
        stale_client = logdir / "client.log"
        stale_server.write_text("STALE-SERVER-OUTPUT")
        stale_client.write_text("STALE-CLIENT-OUTPUT")
        stale_server.chmod(0o444)
        stale_client.chmod(0o444)

        game.start_game(logdir, PORTS, max_vite_retries=2)  # must not raise

        # Old contents are gone: server.log was truncated/re-opened (empty,
        # since the fake server proc writes nothing).
        assert stale_server.read_text() == ""
        assert "STALE-CLIENT-OUTPUT" not in stale_client.read_text()


# --------------------------------------------------------------------------- #
# Pre-launch port freeing
# --------------------------------------------------------------------------- #
class TestPortFreeing:
    def test_waits_for_both_ports_before_launch(self, tmp_path, patched, isolate_pids):
        patched.set_popen(FakePopenFactory([""]))

        game.start_game(tmp_path, PORTS, max_vite_retries=2)

        freed_ports = [port for port, _vp in patched.port_calls]
        assert PORTS.vite in freed_ports
        assert PORTS.game_server in freed_ports

    def test_forwards_allocated_vite_port_to_wait_port_free(self, tmp_path, patched, isolate_pids):
        patched.set_popen(FakePopenFactory([""]))

        game.start_game(tmp_path, PORTS_ALT, max_vite_retries=2)

        # Pre-launch freeing of both ports forwards the allocated vite port so a
        # non-default-port worker recognises its own vite as harness-owned.
        prelaunch = patched.port_calls[:2]
        assert {port for port, _vp in prelaunch} == {PORTS_ALT.vite, PORTS_ALT.game_server}
        assert all(vp == PORTS_ALT.vite for _port, vp in prelaunch)


# --------------------------------------------------------------------------- #
# Server launch + PID tracking
# --------------------------------------------------------------------------- #
class TestServerLaunch:
    def test_server_popen_args_env_and_pid(self, tmp_path, patched, isolate_pids):
        factory = patched.set_popen(FakePopenFactory([""]))

        game.start_game(tmp_path, PORTS, max_vite_retries=2)

        assert len(factory.server_calls) == 1
        call = factory.server_calls[0]
        assert call["args"] == ["node", "game/server/index.js"]
        assert call["kwargs"]["env"]["PORT"] == str(PORTS.game_server)
        assert call["kwargs"]["env"]["ALLOW_DEV_AUTH"] == "1"
        assert call["kwargs"]["start_new_session"] is True
        # PID is appended to the module's tracked list.
        assert call["pid"] in isolate_pids

    def test_server_env_uses_allocated_port(self, tmp_path, patched, isolate_pids):
        factory = patched.set_popen(FakePopenFactory([""]))

        game.start_game(tmp_path, PORTS_ALT, max_vite_retries=2)

        assert factory.server_calls[0]["kwargs"]["env"]["PORT"] == str(PORTS_ALT.game_server)


# --------------------------------------------------------------------------- #
# Vite launch — clean start
# --------------------------------------------------------------------------- #
class TestViteCleanStart:
    def test_clean_start_tracks_pid_and_returns_after_first_attempt(
        self, tmp_path, patched, isolate_pids
    ):
        factory = patched.set_popen(FakePopenFactory([""]))  # clean on attempt 1

        game.start_game(tmp_path, PORTS, max_vite_retries=3)

        assert len(factory.vite_calls) == 1  # no retry
        server_pid = factory.server_calls[0]["pid"]
        vite_pid = factory.vite_calls[0]["pid"]
        assert isolate_pids == [server_pid, vite_pid]
        assert patched.kills == []  # nothing killed on the happy path

    def test_vite_env_harness_game_port_matches_allocated_server(
        self, tmp_path, patched, isolate_pids
    ):
        factory = patched.set_popen(FakePopenFactory([""]))

        game.start_game(tmp_path, PORTS_ALT, max_vite_retries=2)

        assert (
            factory.vite_calls[0]["kwargs"]["env"]["HARNESS_GAME_PORT"]
            == str(PORTS_ALT.game_server)
        )


# --------------------------------------------------------------------------- #
# Vite launch — EADDRINUSE retry loop
# --------------------------------------------------------------------------- #
class TestViteRetry:
    def test_retries_after_eaddrinuse_then_succeeds(self, tmp_path, patched, isolate_pids):
        # First vite attempt logs EADDRINUSE; second is clean.
        factory = patched.set_popen(FakePopenFactory(["Error: listen EADDRINUSE :::5173", ""]))

        game.start_game(tmp_path, PORTS, max_vite_retries=2)

        assert len(factory.vite_calls) == 2  # one retry
        failed_pid = factory.vite_calls[0]["pid"]
        good_pid = factory.vite_calls[1]["pid"]
        server_pid = factory.server_calls[0]["pid"]
        # The failed vite proc's group is killed and its PID popped; the good
        # one stays tracked.
        assert (failed_pid, 9) in patched.kills
        assert isolate_pids == [server_pid, good_pid]
        # The retry re-frees the vite port after cleanup.
        assert PORTS.vite in [port for port, _vp in patched.port_calls]

    def test_detects_already_in_use_phrasing(self, tmp_path, patched, isolate_pids):
        # The matcher also accepts the "already in use" phrasing, not just the
        # EADDRINUSE token.
        factory = patched.set_popen(FakePopenFactory(["Port 5173 is already in use", ""]))

        game.start_game(tmp_path, PORTS, max_vite_retries=2)

        assert len(factory.vite_calls) == 2

    def test_gives_up_after_max_retries_without_raising(self, tmp_path, patched, isolate_pids):
        # Every attempt shows EADDRINUSE: start_game must give up quietly (log an
        # error, do not raise) and leave no vite PID tracked.
        factory = patched.set_popen(
            FakePopenFactory(["EADDRINUSE", "EADDRINUSE"])  # both attempts fail
        )

        game.start_game(tmp_path, PORTS, max_vite_retries=2)  # must not raise

        assert len(factory.vite_calls) == 2
        # Both vite PIDs were popped; only the server PID remains tracked.
        server_pid = factory.server_calls[0]["pid"]
        assert isolate_pids == [server_pid]
        # Each failed attempt killed its proc group.
        assert len(patched.kills) == 2
        # An error is logged on giving up.
        assert any("failed to start" in m.lower() for m in patched.logs)

    def test_max_vite_retries_one_single_attempt(self, tmp_path, patched, isolate_pids):
        # With max_vite_retries=1 a failing vite is attempted exactly once.
        factory = patched.set_popen(FakePopenFactory(["EADDRINUSE"]))

        game.start_game(tmp_path, PORTS, max_vite_retries=1)

        assert len(factory.vite_calls) == 1
        server_pid = factory.server_calls[0]["pid"]
        assert isolate_pids == [server_pid]


# --------------------------------------------------------------------------- #
# Module-state isolation
# --------------------------------------------------------------------------- #
class TestPidIsolation:
    def test_fixture_starts_with_empty_pids(self, isolate_pids):
        # The isolate_pids fixture clears module state before each test.
        assert isolate_pids == []
        assert game._GAME_PIDS is isolate_pids
