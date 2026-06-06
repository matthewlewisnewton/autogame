"""Unit tests for ``stop_game`` and ``wait_for_game`` in ``harness/steps/game.py``.

Covers the previously-uncovered cleanup + readiness paths:
  * ``stop_game`` tracked-PID group kills (SIGTERM) and ``_GAME_PIDS`` drain.
  * ``stop_game`` serial path (``ports=None``) ⇒ blanket pkill of BOTH the
    ``server/index.js`` proc and the default-port (5173) vite.
  * ``stop_game`` parallel path (``ports`` given) ⇒ pkill of ONLY this worker's
    own vite port, never the blanket ``server/index.js`` pkill (which would
    reap sibling workers' servers).
  * ``wait_for_game`` returning True once both client + server probe up, and
    False on timeout when the server never responds — while polling the
    expected client/server URLs derived from ``ports``.

The process/IO/timing seams are monkeypatched so nothing real is killed,
no ``pkill`` runs, and the polling loops run instantly:
  * ``game._kill_proc_group`` -> records ``(pid, signal_num)``.
  * ``game.subprocess.run``   -> records the ``pkill -f <pattern>`` argv.
  * ``game._http_ok`` / ``game._http_responding`` -> scripted, record URLs.
  * ``game.time.sleep`` -> no-op (no real sleeps).
"""
from __future__ import annotations

import pytest

import harness.steps.game as game
from harness.workspace.ports import PortAllocation


# --------------------------------------------------------------------------- #
# Fixtures
# --------------------------------------------------------------------------- #
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
def stop_seams(monkeypatch: pytest.MonkeyPatch):
    """Install the ``stop_game`` seams and return handles for assertions.

    Returns an object with:
      * ``kills``         -> list of (pid, signal_num) passed to _kill_proc_group
      * ``pkill_patterns`` -> list of the ``-f`` patterns passed to pkill
    """
    kills: list[tuple[int, int]] = []
    pkill_patterns: list[str] = []

    monkeypatch.setattr(
        game, "_kill_proc_group",
        lambda pid, signal_num=15: kills.append((pid, signal_num)),
    )

    def fake_run(argv, **kwargs):
        # start_game/stop_game only shell out to pkill here; record its pattern.
        assert argv[:2] == ["pkill", "-f"]
        pkill_patterns.append(argv[2])
        return None

    monkeypatch.setattr(game.subprocess, "run", fake_run)
    monkeypatch.setattr(game.time, "sleep", lambda _s: None)

    class Handles:
        def __init__(self) -> None:
            self.kills = kills
            self.pkill_patterns = pkill_patterns

    return Handles()


PORTS = PortAllocation(game_server=3000, vite=5173)
PORTS_ALT = PortAllocation(game_server=3007, vite=5180)


# --------------------------------------------------------------------------- #
# stop_game — tracked-PID group kills
# --------------------------------------------------------------------------- #
class TestStopGamePidKills:
    def test_kills_every_tracked_pid_with_sigterm_and_drains_list(
        self, stop_seams, isolate_pids
    ):
        isolate_pids.extend([111, 222, 333])

        game.stop_game()  # serial path

        # Every tracked pid is group-killed with SIGTERM (15) ...
        assert stop_seams.kills == [(111, 15), (222, 15), (333, 15)]
        # ... and the tracked list is emptied afterward.
        assert game._GAME_PIDS == []

    def test_no_tracked_pids_kills_nothing(self, stop_seams, isolate_pids):
        # Nothing tracked ⇒ no group kills, but the pkill sweep still runs.
        game.stop_game()

        assert stop_seams.kills == []
        assert game._GAME_PIDS == []


# --------------------------------------------------------------------------- #
# stop_game — serial path (ports=None)
# --------------------------------------------------------------------------- #
class TestStopGameSerialPath:
    def test_serial_pkills_both_server_and_default_vite(self, stop_seams, isolate_pids):
        game.stop_game(ports=None)

        patterns = stop_seams.pkill_patterns
        # Serial path issues exactly two pkill patterns.
        assert len(patterns) == 2
        # One targets the game server's index.js cmdline (incl. bare index.js) ...
        assert any("index\\.js" in p for p in patterns)
        # ... the other the default-port (5173) vite.
        assert any("vite" in p and "5173" in p for p in patterns)


# --------------------------------------------------------------------------- #
# stop_game — parallel path (ports given)
# --------------------------------------------------------------------------- #
class TestStopGameParallelPath:
    def test_parallel_pkills_only_own_vite_port(self, stop_seams, isolate_pids):
        game.stop_game(ports=PORTS_ALT)

        patterns = stop_seams.pkill_patterns
        # Exactly one pattern: the worker's own vite port only.
        assert len(patterns) == 1
        assert "vite" in patterns[0]
        assert str(PORTS_ALT.vite) in patterns[0]
        # The blanket server/index.js pkill is deliberately omitted so we never
        # reap a sibling parallel worker's server.
        assert all("server/index" not in p for p in patterns)

    def test_parallel_still_group_kills_tracked_pids(self, stop_seams, isolate_pids):
        isolate_pids.extend([900, 901])

        game.stop_game(ports=PORTS_ALT)

        assert stop_seams.kills == [(900, 15), (901, 15)]
        assert game._GAME_PIDS == []


# --------------------------------------------------------------------------- #
# wait_for_game — readiness polling loop
# --------------------------------------------------------------------------- #
class TestWaitForGame:
    def test_returns_true_when_both_client_and_server_up(self, monkeypatch):
        client_urls: list[str] = []
        server_urls: list[str] = []

        def fake_http_ok(url):
            client_urls.append(url)
            return True

        def fake_healthz_ready(url):
            server_urls.append(url)
            return True

        monkeypatch.setattr(game, "_http_ok", fake_http_ok)
        monkeypatch.setattr(game, "_healthz_ready", fake_healthz_ready)
        monkeypatch.setattr(game.time, "sleep", lambda _s: None)

        assert game.wait_for_game(PORTS, timeout_s=45) is True

        # Probed the client on the allocated vite port ...
        assert any(f":{PORTS.vite}/" in u for u in client_urls)
        # ... and the server on the allocated game_server port.
        assert any(f":{PORTS.game_server}/" in u for u in server_urls)

    def test_returns_false_on_timeout_when_server_never_responds(self, monkeypatch):
        client_urls: list[str] = []
        server_urls: list[str] = []

        def fake_http_ok(url):
            client_urls.append(url)
            return True  # client is up immediately

        def fake_healthz_ready(url):
            server_urls.append(url)
            return False  # server never ready

        monkeypatch.setattr(game, "_http_ok", fake_http_ok)
        monkeypatch.setattr(game, "_healthz_ready", fake_healthz_ready)
        monkeypatch.setattr(game.time, "sleep", lambda _s: None)

        # Short timeout so the (no-real-sleep) loop bails quickly.
        assert game.wait_for_game(PORTS_ALT, timeout_s=1) is False

        # Even on timeout, it polled the expected client/server URLs.
        assert any(f":{PORTS_ALT.vite}/" in u for u in client_urls)
        assert any(f":{PORTS_ALT.game_server}/" in u for u in server_urls)

    def test_uses_allocated_ports_in_probe_urls(self, monkeypatch):
        # The probe URLs track the allocation, not hardcoded 3000/5173 defaults.
        client_urls: list[str] = []
        server_urls: list[str] = []

        monkeypatch.setattr(game, "_http_ok",
                            lambda url: client_urls.append(url) or True)
        monkeypatch.setattr(game, "_healthz_ready",
                            lambda url: server_urls.append(url) or True)
        monkeypatch.setattr(game.time, "sleep", lambda _s: None)

        game.wait_for_game(PORTS_ALT, timeout_s=45)

        assert client_urls and all(str(PORTS_ALT.vite) in u for u in client_urls)
        assert server_urls and all(str(PORTS_ALT.game_server) in u for u in server_urls)
