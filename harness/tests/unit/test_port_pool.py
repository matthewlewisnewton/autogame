"""Port pool + per-worker vite-port matching (parallel-factory Phase 1)."""
from __future__ import annotations

import pytest

from harness.steps.game import _is_harness_game_proc
from harness.workspace.ports import PortAllocation, allocate_pool, default_ports


def test_default_ports_fallback(monkeypatch):
    monkeypatch.delenv("HARNESS_GAME_PORT", raising=False)
    monkeypatch.delenv("HARNESS_VITE_PORT", raising=False)
    p = default_ports()
    assert (p.game_server, p.vite) == (3000, 5173)


def test_default_ports_env_override(monkeypatch):
    monkeypatch.setenv("HARNESS_GAME_PORT", "3007")
    monkeypatch.setenv("HARNESS_VITE_PORT", "5180")
    p = default_ports()
    assert (p.game_server, p.vite) == (3007, 5180)


def test_allocate_pool_distinct_nonoverlapping():
    pool = allocate_pool(3)
    assert pool == [
        PortAllocation(3000, 5173),
        PortAllocation(3001, 5174),
        PortAllocation(3002, 5175),
    ]
    # every port across the pool is unique
    ports = [pa.game_server for pa in pool] + [pa.vite for pa in pool]
    assert len(set(ports)) == len(ports)


def test_allocate_pool_rejects_overlap():
    with pytest.raises(ValueError):
        allocate_pool(3000)  # game range would reach the vite base


def test_vite_match_is_port_specific():
    # A worker on vite 5174 must recognise its own vite, and NOT a sibling's
    # vite on 5173 (otherwise it would kill the wrong worker's server).
    assert _is_harness_game_proc("node .../vite/bin/vite.js --port 5174 --strictPort", 5174)
    assert not _is_harness_game_proc("node .../vite/bin/vite.js --port 5173 --strictPort", 5174)
    # server match stays port-agnostic regardless of vite_port.
    assert _is_harness_game_proc("node game/server/index.js", 5174)
