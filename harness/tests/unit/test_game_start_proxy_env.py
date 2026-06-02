"""Unit test: start_game passes HARNESS_GAME_PORT into the Vite child env.

Guards the capture failure where the game server bound to an allocated port
(e.g. 3002) but Vite proxied /api and /socket.io to localhost:3000 because
HARNESS_GAME_PORT was not wired into the Vite subprocess environment.
"""
from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock, patch

from harness.steps import game as game_mod
from harness.workspace.ports import PortAllocation


def test_start_game_vite_env_includes_harness_game_port(tmp_path: Path) -> None:
    ports = PortAllocation(game_server=3002, vite=5175)
    popen_calls: list[dict] = []

    def fake_popen(cmd, **kwargs):
        proc = MagicMock()
        proc.pid = 1000 + len(popen_calls)
        popen_calls.append({"cmd": list(cmd), **kwargs})
        return proc

    with patch.object(game_mod.subprocess, "Popen", side_effect=fake_popen):
        with patch.object(game_mod, "wait_port_free", return_value=True):
            with patch("time.sleep"):
                with patch.object(game_mod, "emit_progress_event"):
                    game_mod._GAME_PIDS.clear()
                    try:
                        game_mod.start_game(tmp_path, ports)
                    finally:
                        game_mod._GAME_PIDS.clear()

    assert len(popen_calls) == 2
    server_call, vite_call = popen_calls
    assert server_call["env"]["PORT"] == "3002"
    assert vite_call["env"]["HARNESS_GAME_PORT"] == "3002"
    assert vite_call["env"]["HARNESS_VITE_PORT"] == "5175"
    assert vite_call["cmd"][:3] == ["npx", "vite", "--port"]
    assert vite_call["cmd"][3] == "5175"
