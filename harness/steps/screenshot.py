"""Screenshot capture step — invokes harness/screenshot.mjs as a subprocess."""
from __future__ import annotations

import subprocess
from pathlib import Path

from harness.telemetry.logging import log


def capture(game_url: str, artifacts_dir: Path, *, timeout_s: int = 120) -> bool:
    """Run `node harness/screenshot.mjs <url> <artifacts_dir>`."""
    artifacts_dir = Path(artifacts_dir)
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    log_path = artifacts_dir / "screenshot.log"
    # protect_review chmods round-N artifact dirs a-w after a previous
    # round commits — same gotcha as start_game's server.log/client.log
    # (fixed in f059c4b). Clear the read-only flag before re-opening
    # screenshot.log so a fresh round can capture again.
    try:
        log_path.chmod(0o644)
    except (FileNotFoundError, PermissionError, OSError):
        pass
    try:
        log_path.unlink()
    except (FileNotFoundError, PermissionError, OSError):
        pass
    script = Path(__file__).resolve().parents[1] / "screenshot.mjs"
    try:
        with log_path.open("wb") as out:
            result = subprocess.run(
                ["node", str(script), game_url, str(artifacts_dir)],
                stdin=subprocess.DEVNULL, stdout=out, stderr=subprocess.STDOUT,
                timeout=timeout_s,
            )
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired) as e:
        log(f"[screenshot] failed: {e}")
        return False


__all__ = ["capture"]
