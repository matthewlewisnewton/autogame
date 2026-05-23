"""capture_run — pre-review screenshot pass for a ticket round."""
from __future__ import annotations

import json
from pathlib import Path

from harness.steps.game import (
    _port_holders,
    start_game,
    stop_game,
    wait_for_game,
)
from harness.steps.screenshot import capture
from harness.workspace.ports import PortAllocation


_INFRA_SIGNATURES = {
    "vite_eaddrinuse": ("EADDRINUSE", "Port 5173 is already in use", "address already in use"),
    "server_eaddrinuse": ("listen EADDRINUSE", "address already in use :::3000"),
}


def _diagnose_servers_did_not_start(dir: Path, ports: PortAllocation) -> dict:
    """When `wait_for_game` times out, scan the logs and inspect port holders
    so the review LLM can distinguish a harness-infra failure (port leak,
    foreign holder, etc.) from a real game crash. Without this distinction
    the review prompt force-fails the ticket on every captured run that
    couldn't even start the dev servers — irrespective of code quality."""
    diag: dict = {"detected": []}
    for name, logfile in (("client", "client.log"), ("server", "server.log")):
        p = dir / logfile
        if not p.exists():
            diag[f"{name}_log_tail"] = "<missing>"
            continue
        try:
            text = p.read_text(errors="replace")
        except OSError:
            diag[f"{name}_log_tail"] = "<unreadable>"
            continue
        diag[f"{name}_log_tail"] = "\n".join(text.splitlines()[-30:])
        for kind, sigs in _INFRA_SIGNATURES.items():
            if any(s in text for s in sigs):
                diag["detected"].append(kind)
                break
    diag["port_holders"] = {
        str(ports.vite): [
            {"pid": pid, "cmdline": cmd[:200]}
            for pid, cmd in _port_holders(ports.vite)
        ],
        str(ports.game_server): [
            {"pid": pid, "cmdline": cmd[:200]}
            for pid, cmd in _port_holders(ports.game_server)
        ],
    }
    return diag


def capture_run(dir: Path, *, game_url: str, ports: PortAllocation) -> bool:
    dir = Path(dir)
    dir.mkdir(parents=True, exist_ok=True)
    start_game(dir, ports)
    try:
        if wait_for_game(ports, timeout_s=45):
            capture(game_url, dir)
            return True
        harness_failure = _diagnose_servers_did_not_start(dir, ports)
        (dir / "metrics.json").write_text(
            json.dumps({
                "ok": False,
                "error": "servers did not start",
                "harness_failure": harness_failure,
            }, indent=2) + "\n"
        )
        return False
    finally:
        stop_game()


__all__ = ["capture_run"]
