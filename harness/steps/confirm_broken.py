"""confirm_game_broken + game_smoke_ok — ports lib.sh:262-296."""
from __future__ import annotations

import json
import re
from pathlib import Path

from harness.telemetry.logging import log
from harness.workspace.ports import PortAllocation


def game_smoke_ok(artifacts_dir: Path) -> bool:
    """True iff a captured run shows a runnable game. Mirrors lib.sh::game_smoke_ok."""
    artifacts_dir = Path(artifacts_dir)
    metrics = artifacts_dir / "metrics.json"
    if not metrics.exists():
        return False
    try:
        data = json.loads(metrics.read_text())
    except (OSError, json.JSONDecodeError):
        return False
    if data.get("ok") is False:
        return False
    if "servers did not start" in str(data.get("error", "") or ""):
        return False
    console = artifacts_dir / "console.log"
    if console.exists():
        try:
            text = console.read_text(errors="replace")
        except OSError:
            text = ""
        if re.search(r"\[[A-Z]:pageerror\]|\[fatal\]", text):
            return False
    return True


def confirm_game_broken(suspect_dir: Path, confirmation_dir: Path,
                        *, game_url: str, ports: PortAllocation) -> bool:
    """Second capture run to disambiguate flake. True iff CONFIRMED broken."""
    from harness.steps.game import start_game, stop_game, wait_for_game
    from harness.steps.screenshot import capture
    log("[confirm] second capture run to disambiguate game-smoke flake...")
    confirmation_dir = Path(confirmation_dir)
    confirmation_dir.mkdir(parents=True, exist_ok=True)
    start_game(confirmation_dir, ports)
    try:
        if not wait_for_game(ports, timeout_s=45):
            (confirmation_dir / "metrics.json").write_text(
                json.dumps({"ok": False, "error": "servers did not start"}) + "\n"
            )
            return True
        capture(game_url, confirmation_dir)
    finally:
        stop_game()
    confirmed = not game_smoke_ok(confirmation_dir)
    if confirmed:
        log("[confirm] confirmation run also failed — game IS broken")
    else:
        log("[confirm] confirmation run passed — accepting review PASS over the flake")
    return confirmed


__all__ = ["confirm_game_broken", "game_smoke_ok"]
