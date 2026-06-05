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


# Per-log signatures: server patterns are checked only in server.log and vite
# patterns only in client.log so a generic "EADDRINUSE" in server.log is not
# misclassified as vite_eaddrinuse (ticket 242 infra escalation).
_INFRA_SIGNATURES: dict[str, tuple[str, ...]] = {
    "server_eaddrinuse": ("listen EADDRINUSE", "address already in use :::3000"),
    "vite_eaddrinuse": (
        "Port 5173 is already in use",
        "EADDRINUSE",
        "already in use :::5173",
    ),
}
_LOG_KIND_FOR_SIGNATURE = {
    "server_eaddrinuse": "server",
    "vite_eaddrinuse": "client",
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
        log_name = _LOG_KIND_FOR_SIGNATURE.get(kind)
        if log_name is None:
            continue
        p = dir / f"{log_name}.log"
        if not p.exists():
            continue
        try:
            text = p.read_text(errors="replace")
        except OSError:
            continue
        if any(s in text for s in sigs):
            diag["detected"].append(kind)
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


def _read_pageerrors(dir: Path) -> list:
    """Read page errors from pageerrors.json or metrics.json.pageerrors."""
    pe_file = dir / "pageerrors.json"
    if pe_file.exists():
        try:
            data = json.loads(pe_file.read_text())
            if isinstance(data, list):
                return data
        except (OSError, json.JSONDecodeError):
            pass
    metrics_file = dir / "metrics.json"
    if metrics_file.exists():
        try:
            data = json.loads(metrics_file.read_text())
            pe = data.get("pageerrors")
            if isinstance(pe, list):
                return pe
        except (OSError, json.JSONDecodeError):
            pass
    return []


def _classify_capture_failure(dir: Path, ports: PortAllocation) -> dict:
    """Classify a capture failure into one of three failure kinds.

    Returns a metrics dict with the appropriate structure:
    - harness_failure: when infra signatures (EADDRINUSE, etc.) are detected
    - browser_pageerror: when servers started but browser code threw errors
    - capture_failed: generic fallback with diagnosis block for investigation
    """
    diagnosis = _diagnose_servers_did_not_start(dir, ports)
    detected = diagnosis.get("detected", [])
    pageerrors = _read_pageerrors(dir)

    if detected:
        # Infra signatures found — this is a harness infrastructure failure
        return {
            "ok": False,
            "error": "servers did not start",
            "harness_failure": diagnosis,
        }
    elif pageerrors:
        # No infra issue, but browser threw page errors — code defect
        return {
            "ok": False,
            "failure_kind": "browser_pageerror",
            "pageerrors": pageerrors,
        }
    else:
        # No infra issue, no page errors — generic capture failure
        return {
            "ok": False,
            "failure_kind": "capture_failed",
            "capture_diagnosis": diagnosis,
        }


def capture_run(dir: Path, *, game_url: str, ports: PortAllocation) -> bool:
    dir = Path(dir)
    dir.mkdir(parents=True, exist_ok=True)
    start_game(dir, ports)
    # The game is served on the ALLOCATED vite port (start_game uses ports.vite),
    # so the capture must hit that port — not the static game_url default, which
    # in a parallel worker points at port 5173 (a sibling's, or nothing). The
    # static game_url is only a host fallback for non-default setups.
    capture_url = ports.vite_url if ports else game_url
    try:
        servers_up = wait_for_game(ports, timeout_s=45)
        if servers_up:
            capture_ok = capture(capture_url, dir)
            if capture_ok:
                # Capture succeeded, but the run may still have recorded page
                # errors. The servers are known up here, so skip the infra
                # scan and promote a non-empty pageerrors list straight to a
                # browser_pageerror failure (no harness_failure block).
                pageerrors = _read_pageerrors(dir)
                if pageerrors:
                    metrics = {
                        "ok": False,
                        "failure_kind": "browser_pageerror",
                        "pageerrors": pageerrors,
                    }
                    (dir / "metrics.json").write_text(
                        json.dumps(metrics, indent=2) + "\n"
                    )
                    return False
                return True
            # Capture returned failure but servers started — classify
            metrics = _classify_capture_failure(dir, ports)
            (dir / "metrics.json").write_text(
                json.dumps(metrics, indent=2) + "\n"
            )
            return False
        # Servers didn't come up — classify the failure
        metrics = _classify_capture_failure(dir, ports)
        (dir / "metrics.json").write_text(
            json.dumps(metrics, indent=2) + "\n"
        )
        return False
    except Exception as e:
        # Unexpected exception — still write metrics.json so the pipeline
        # has a classified result instead of a missing file.
        metrics = {
            "ok": False,
            "failure_kind": "capture_exception",
            "error": str(e),
        }
        (dir / "metrics.json").write_text(
            json.dumps(metrics, indent=2) + "\n"
        )
        return False
    finally:
        stop_game()


__all__ = ["capture_run", "_classify_capture_failure", "_read_pageerrors", "_diagnose_servers_did_not_start"]
