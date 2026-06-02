"""Per-worktree dependency setup.

A fresh `git worktree` has no `node_modules` (gitignored, never checked out), so
a worker can't run the game until deps are installed. pnpm makes this cheap:
`pnpm install --frozen-lockfile` hardlinks packages from the shared global store
(~/.local/share/pnpm/store) rather than copying or re-downloading, so each
worktree gets its OWN isolated node_modules in seconds with ~no extra disk.

Isolation (not a symlink to main) is deliberate: a ticket may add/modify a
dependency, and that must not leak into sibling worktrees or the live loop on
main. Concurrent installs from multiple worktrees are safe — pnpm serializes
access to the shared store internally.
"""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path
from typing import Callable

from harness.telemetry.logging import log


def install_deps(root: Path, *, pnpm: str = "pnpm", timeout_s: int = 600,
                 runner: Callable = subprocess.run,
                 which: Callable = shutil.which) -> bool:
    """Install this worktree's deps with `pnpm install --frozen-lockfile`.

    Returns True on success (or when there's nothing to do). False on a real
    install failure so the worker can signal an infra problem (→ requeue).
    `runner`/`which` are injected for testing.
    """
    root = Path(root)
    # The pnpm workspace root may be the worktree root or a subdir (this repo's
    # lockfile + pnpm-workspace.yaml live under game/). Install where the
    # lockfile actually is, or there'd be no node_modules and the game wouldn't
    # start.
    install_dir = next((d for d in (root, root / "game")
                        if (d / "pnpm-lock.yaml").exists()), None)
    if install_dir is None:
        log(f"[worktree-setup] no pnpm-lock.yaml under {root} or {root}/game — skipping install")
        return True
    if which(pnpm) is None:
        log(f"[worktree-setup] '{pnpm}' not on PATH — cannot install deps")
        return False
    log(f"[worktree-setup] pnpm install --frozen-lockfile in {install_dir} ...")
    try:
        proc = runner([pnpm, "install", "--frozen-lockfile"], cwd=str(install_dir),
                      capture_output=True, text=True, timeout=timeout_s)
    except (FileNotFoundError, subprocess.TimeoutExpired) as e:
        log(f"[worktree-setup] pnpm install errored: {e!r}")
        return False
    if getattr(proc, "returncode", 1) != 0:
        tail = ((getattr(proc, "stderr", "") or getattr(proc, "stdout", "")) or "")[-400:]
        log(f"[worktree-setup] pnpm install failed (rc={proc.returncode}): {tail}")
        return False
    return True


__all__ = ["install_deps"]
