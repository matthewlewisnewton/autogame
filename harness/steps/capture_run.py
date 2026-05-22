"""capture_run — pre-review screenshot pass for a ticket round."""
from __future__ import annotations

import json
from pathlib import Path

from harness.steps.game import start_game, stop_game, wait_for_game
from harness.steps.screenshot import capture
from harness.workspace.ports import PortAllocation


def capture_run(dir: Path, *, game_url: str, ports: PortAllocation) -> bool:
    dir = Path(dir)
    dir.mkdir(parents=True, exist_ok=True)
    start_game(dir, ports)
    try:
        if wait_for_game(ports, timeout_s=45):
            capture(game_url, dir)
            return True
        (dir / "metrics.json").write_text(
            json.dumps({"ok": False, "error": "servers did not start"}) + "\n"
        )
        return False
    finally:
        stop_game()


__all__ = ["capture_run"]
