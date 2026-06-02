"""Regression: Vite subprocess must receive PORT + HARNESS_GAME_PORT from
PortAllocation so vite.config.js proxies to the harness game server even when
the parent shell has no port env vars."""
from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock

import pytest

from harness.steps import game as game_mod
from harness.workspace.ports import PortAllocation


@pytest.fixture(autouse=True)
def _isolate_game_pids(monkeypatch):
    monkeypatch.setattr(game_mod, "_GAME_PIDS", [])


@pytest.fixture
def _quiet_start_game(monkeypatch):
    monkeypatch.setattr(game_mod, "wait_port_free", lambda *a, **kw: True)
    monkeypatch.setattr(game_mod.time, "sleep", lambda *_a, **_kw: None)
    monkeypatch.setattr(game_mod, "emit_progress_event", lambda *a, **kw: None)


def test_vite_popen_env_uses_allocated_game_port(
    tmp_path: Path, monkeypatch, _quiet_start_game
):
    monkeypatch.delenv("PORT", raising=False)
    monkeypatch.delenv("HARNESS_GAME_PORT", raising=False)

    popen_calls: list[dict] = []
    pid = 9000

    def fake_popen(args, **kwargs):
        nonlocal pid
        proc = MagicMock()
        proc.pid = pid
        pid += 1
        popen_calls.append({"args": list(args), **kwargs})
        return proc

    monkeypatch.setattr(game_mod.subprocess, "Popen", fake_popen)

    ports = PortAllocation(game_server=3004, vite=5175)
    game_mod.start_game(tmp_path, ports)

    vite_calls = [c for c in popen_calls if c["args"][:2] == ["npx", "vite"]]
    assert len(vite_calls) == 1
    env = vite_calls[0]["env"]
    assert env["PORT"] == "3004"
    assert env["HARNESS_GAME_PORT"] == "3004"

    server_calls = [
        c for c in popen_calls if c["args"] == ["node", "game/server/index.js"]
    ]
    assert len(server_calls) == 1
    assert server_calls[0]["env"]["PORT"] == "3004"
    assert "HARNESS_GAME_PORT" not in server_calls[0]["env"]
