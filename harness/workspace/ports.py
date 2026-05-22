"""PortAllocator — day-1 default returns the fixed (3000, 5173) pair.

Phase 6 will swap this for a worker-pool allocator when WorktreeWorkspace
ships. The game-side server + vite hardcode these ports today; phase 6
prerequisite is `--server-port` / `--vite-port` flags on `node
game/server/index.js` and the vite config.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class PortAllocation:
    game_server: int = 3000
    vite: int = 5173


def default_ports() -> PortAllocation:
    return PortAllocation()


__all__ = ["PortAllocation", "default_ports"]
