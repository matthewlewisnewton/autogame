"""Port allocation for game dev-servers.

Single-instance default is the historical (3000, 5173) pair, now env-overridable
(HARNESS_GAME_PORT / HARNESS_VITE_PORT) so parallel workers each get a distinct
pair. `allocate_pool(n)` hands out N non-overlapping pairs for the dispatcher.
The game server honors `PORT` (game/server/index.js) and vite takes `--port`,
so start_game just wires these through.
"""
from __future__ import annotations

import os
from dataclasses import dataclass

_DEFAULT_GAME = 3000
_DEFAULT_VITE = 5173


@dataclass(frozen=True)
class PortAllocation:
    game_server: int = _DEFAULT_GAME
    vite: int = _DEFAULT_VITE


def default_ports() -> PortAllocation:
    """Ports for one instance. No env set ⇒ the historical (3000, 5173) serial
    default, so this is backward compatible."""
    return PortAllocation(
        game_server=int(os.environ.get("HARNESS_GAME_PORT", _DEFAULT_GAME)),
        vite=int(os.environ.get("HARNESS_VITE_PORT", _DEFAULT_VITE)),
    )


def allocate_pool(n: int, *, game_base: int = _DEFAULT_GAME,
                  vite_base: int = _DEFAULT_VITE) -> list[PortAllocation]:
    """N non-overlapping port pairs for parallel workers: worker i gets
    (game_base+i, vite_base+i). Raises if the game range would reach into the
    vite range (keep n well under vite_base-game_base)."""
    if n < 0:
        raise ValueError("n must be >= 0")
    if game_base + n > vite_base:
        raise ValueError(
            f"pool of {n} from game_base={game_base} overlaps vite_base={vite_base}")
    return [PortAllocation(game_server=game_base + i, vite=vite_base + i)
            for i in range(n)]


__all__ = ["PortAllocation", "default_ports", "allocate_pool"]
