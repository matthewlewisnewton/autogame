"""Unit tests for the port-freeing and process-kill helpers in
``harness/steps/game.py``: ``port_in_use``, ``wait_port_free``, ``_kill_pid``
and ``_kill_proc_group``.

These are the exact paths behind the prior orphan-proc / EADDRINUSE infra bugs
(harness-fixes-2026-05-31) and previously had no direct coverage. The tests
monkeypatch the holder/kill seams so no real processes are signalled and the
retry loop runs instantly.
"""
from __future__ import annotations

import socket

import pytest

import harness.steps.game as game
from harness.steps.game import (
    port_in_use,
    wait_port_free,
    _kill_pid,
    _kill_proc_group,
)

# Reference cmdlines (see ticket Technical Specs).
SERVER_CMD = "node game/server/index.js"
VITE_CMD = "vite --port 5173 --strictPort"
VITE_5177_CMD = "vite --port 5177 --strictPort"
FOREIGN_CMD = "node /srv/other-app/server.js"


class FakeClock:
    """Deterministic stand-in for the ``time`` module used by wait_port_free.

    ``sleep`` advances a virtual clock so the deadline loop terminates without
    real wall-clock waits.
    """

    def __init__(self, start: float = 1000.0) -> None:
        self.now = start

    def time(self) -> float:
        return self.now

    def sleep(self, seconds: float) -> None:
        self.now += seconds


# --------------------------------------------------------------------------- #
# port_in_use
# --------------------------------------------------------------------------- #
class TestPortInUse:
    def test_free_port_returns_false(self) -> None:
        # Grab an ephemeral port, release it, then confirm it reads as free.
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(("127.0.0.1", 0))
            port = s.getsockname()[1]
        assert port_in_use(port) is False

    def test_bound_port_returns_true(self) -> None:
        # Hold a real listening socket so the helper's bind() fails.
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(("127.0.0.1", 0))
            s.listen()
            port = s.getsockname()[1]
            assert port_in_use(port) is True

    def test_bound_port_via_monkeypatched_bind(self, monkeypatch: pytest.MonkeyPatch) -> None:
        # Belt-and-suspenders: a bind raising OSError must read as "in use".
        # port_in_use wraps the socket in contextlib.closing, which calls
        # close() on exit -- not __enter__/__exit__.
        class FakeSock:
            def close(self):
                pass

            def bind(self, _addr):
                raise OSError("address already in use")

        monkeypatch.setattr(game.socket, "socket", lambda *a, **k: FakeSock())
        assert port_in_use(3000) is True


# --------------------------------------------------------------------------- #
# wait_port_free
# --------------------------------------------------------------------------- #
class TestWaitPortFree:
    def test_returns_true_immediately_when_free(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(game, "port_in_use", lambda port: False)

        def boom(port):  # holders must never be consulted when already free
            raise AssertionError("_port_holders should not be called when port is free")

        monkeypatch.setattr(game, "_port_holders", boom)
        kills: list[tuple[int, int]] = []
        monkeypatch.setattr(game, "_kill_pid", lambda pid, signal_num=9: kills.append((pid, signal_num)))
        monkeypatch.setattr(game, "time", FakeClock())

        assert wait_port_free(3000, timeout_s=15) is True
        assert kills == []

    def test_kills_harness_holder_then_returns_true(self, monkeypatch: pytest.MonkeyPatch) -> None:
        state = {"bound": True}
        monkeypatch.setattr(game, "port_in_use", lambda port: state["bound"])
        monkeypatch.setattr(game, "_port_holders", lambda port: [(4242, SERVER_CMD)])

        kills: list[tuple[int, int]] = []

        def fake_kill(pid, signal_num=9):
            kills.append((pid, signal_num))
            state["bound"] = False  # the kill frees the port

        monkeypatch.setattr(game, "_kill_pid", fake_kill)
        monkeypatch.setattr(game, "time", FakeClock())

        assert wait_port_free(3000, timeout_s=15) is True
        assert kills == [(4242, 9)]

    def test_returns_false_on_timeout_when_port_stays_bound(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(game, "port_in_use", lambda port: True)  # never frees
        monkeypatch.setattr(game, "_port_holders", lambda port: [(4242, SERVER_CMD)])
        monkeypatch.setattr(game, "_kill_pid", lambda pid, signal_num=9: None)
        monkeypatch.setattr(game, "time", FakeClock())

        assert wait_port_free(3000, timeout_s=2) is False

    def test_foreign_holder_not_killed_returns_false(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("HARNESS_BROAD_PORT_KILL", raising=False)
        monkeypatch.setattr(game, "port_in_use", lambda port: True)
        monkeypatch.setattr(game, "_port_holders", lambda port: [(9999, FOREIGN_CMD)])

        kills: list[int] = []
        monkeypatch.setattr(game, "_kill_pid", lambda pid, signal_num=9: kills.append(pid))
        monkeypatch.setattr(game, "time", FakeClock())

        assert wait_port_free(3000, timeout_s=2) is False
        assert kills == []  # a foreign proc must never be killed

    def test_broad_kill_env_kills_foreign_holder(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("HARNESS_BROAD_PORT_KILL", "1")
        state = {"bound": True}
        monkeypatch.setattr(game, "port_in_use", lambda port: state["bound"])
        monkeypatch.setattr(game, "_port_holders", lambda port: [(9999, FOREIGN_CMD)])

        kills: list[int] = []

        def fake_kill(pid, signal_num=9):
            kills.append(pid)
            state["bound"] = False

        monkeypatch.setattr(game, "_kill_pid", fake_kill)
        monkeypatch.setattr(game, "time", FakeClock())

        assert wait_port_free(3000, timeout_s=15) is True
        assert kills == [9999]  # broad kill overrides the harness-owned check

    def test_forwards_vite_port_to_recognise_non_default_holder(self, monkeypatch: pytest.MonkeyPatch) -> None:
        # A vite holder on a non-default port (5177) is only recognised as
        # harness-owned when wait_port_free forwards vite_port to the matcher.
        monkeypatch.delenv("HARNESS_BROAD_PORT_KILL", raising=False)
        state = {"bound": True}
        monkeypatch.setattr(game, "port_in_use", lambda port: state["bound"])
        monkeypatch.setattr(game, "_port_holders", lambda port: [(5151, VITE_5177_CMD)])

        kills: list[int] = []

        def fake_kill(pid, signal_num=9):
            kills.append(pid)
            state["bound"] = False

        monkeypatch.setattr(game, "_kill_pid", fake_kill)
        monkeypatch.setattr(game, "time", FakeClock())

        assert wait_port_free(5177, timeout_s=15, vite_port=5177) is True
        assert kills == [5151]

    def test_default_vite_port_does_not_match_5177_holder(self, monkeypatch: pytest.MonkeyPatch) -> None:
        # Contrast: without forwarding vite_port, the same 5177 holder reads as
        # foreign and is left alone -> timeout/False.
        monkeypatch.delenv("HARNESS_BROAD_PORT_KILL", raising=False)
        monkeypatch.setattr(game, "port_in_use", lambda port: True)
        monkeypatch.setattr(game, "_port_holders", lambda port: [(5151, VITE_5177_CMD)])

        kills: list[int] = []
        monkeypatch.setattr(game, "_kill_pid", lambda pid, signal_num=9: kills.append(pid))
        monkeypatch.setattr(game, "time", FakeClock())

        assert wait_port_free(5177, timeout_s=2) is False  # default vite_port=5173
        assert kills == []


# --------------------------------------------------------------------------- #
# _kill_pid
# --------------------------------------------------------------------------- #
class TestKillPid:
    def test_calls_os_kill(self, monkeypatch: pytest.MonkeyPatch) -> None:
        calls: list[tuple[int, int]] = []
        monkeypatch.setattr(game.os, "kill", lambda pid, sig: calls.append((pid, sig)))
        _kill_pid(123, signal_num=9)
        assert calls == [(123, 9)]

    def test_swallows_process_lookup_error(self, monkeypatch: pytest.MonkeyPatch) -> None:
        def raise_lookup(pid, sig):
            raise ProcessLookupError

        monkeypatch.setattr(game.os, "kill", raise_lookup)
        _kill_pid(123)  # must not raise

    def test_swallows_permission_error(self, monkeypatch: pytest.MonkeyPatch) -> None:
        def raise_perm(pid, sig):
            raise PermissionError

        monkeypatch.setattr(game.os, "kill", raise_perm)
        _kill_pid(123)  # must not raise


# --------------------------------------------------------------------------- #
# _kill_proc_group
# --------------------------------------------------------------------------- #
class TestKillProcGroup:
    def test_signals_process_group(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(game.os, "getpgid", lambda pid: 999)
        calls: list[tuple[int, int]] = []
        monkeypatch.setattr(game.os, "killpg", lambda pgid, sig: calls.append((pgid, sig)))
        # _kill_pid must NOT be reached on the happy path.
        monkeypatch.setattr(game, "_kill_pid", lambda *a, **k: pytest.fail("fallback should not run"))

        _kill_proc_group(123, signal_num=15)
        assert calls == [(999, 15)]

    def test_falls_back_to_kill_pid_on_getpgid_lookup_error(self, monkeypatch: pytest.MonkeyPatch) -> None:
        def raise_lookup(pid):
            raise ProcessLookupError

        monkeypatch.setattr(game.os, "getpgid", raise_lookup)
        fallback: list[tuple[int, int]] = []
        monkeypatch.setattr(game, "_kill_pid", lambda pid, signal_num: fallback.append((pid, signal_num)))

        _kill_proc_group(123, signal_num=15)
        assert fallback == [(123, 15)]

    def test_falls_back_to_kill_pid_on_killpg_oserror(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(game.os, "getpgid", lambda pid: 999)

        def raise_oserror(pgid, sig):
            raise OSError("no such process group")

        monkeypatch.setattr(game.os, "killpg", raise_oserror)
        fallback: list[tuple[int, int]] = []
        monkeypatch.setattr(game, "_kill_pid", lambda pid, signal_num: fallback.append((pid, signal_num)))

        _kill_proc_group(456, signal_num=9)
        assert fallback == [(456, 9)]
