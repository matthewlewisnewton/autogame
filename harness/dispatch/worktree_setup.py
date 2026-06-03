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


def _harness_playwright_ok(modules: Path) -> bool:
    """True when `import 'playwright'` from harness/ would resolve."""
    try:
        return (modules / "playwright").exists()
    except OSError:
        return False


def _remove_harness_node_modules(dst: Path) -> None:
    if dst.is_symlink() or dst.is_file():
        dst.unlink()
    elif dst.is_dir():
        shutil.rmtree(dst)


def install_harness_deps(root: Path, *, pnpm: str = "pnpm", timeout_s: int = 600,
                         runner: Callable = subprocess.run,
                         which: Callable = shutil.which) -> bool:
    """Install harness tooling deps (`playwright`, etc.) under `root/harness/`."""
    root = Path(root)
    harness_dir = root / "harness"
    if not (harness_dir / "package.json").exists():
        log(f"[worktree-setup] no harness/package.json under {root} — skipping harness install")
        return True
    if which(pnpm) is None:
        log(f"[worktree-setup] '{pnpm}' not on PATH — cannot install harness deps")
        return False
    log(f"[worktree-setup] pnpm install --frozen-lockfile in {harness_dir} ...")
    try:
        proc = runner([pnpm, "install", "--frozen-lockfile"], cwd=str(harness_dir),
                      capture_output=True, text=True, timeout=timeout_s)
    except (FileNotFoundError, subprocess.TimeoutExpired) as e:
        log(f"[worktree-setup] harness pnpm install errored: {e!r}")
        return False
    if getattr(proc, "returncode", 1) != 0:
        tail = ((getattr(proc, "stderr", "") or getattr(proc, "stdout", "")) or "")[-400:]
        log(f"[worktree-setup] harness pnpm install failed (rc={proc.returncode}): {tail}")
        return False
    return _harness_playwright_ok(harness_dir / "node_modules")


def link_harness_deps(root: Path, *, runner: Callable = subprocess.run,
                      which: Callable = shutil.which) -> bool:
    """Make the worktree's `harness/node_modules` resolve to the main checkout's.

    A git worktree checks out the harness SOURCE (e.g. `harness/screenshot.mjs`)
    but NOT `harness/node_modules` (gitignored). So `node harness/screenshot.mjs`
    can't resolve `import 'playwright'` and the capture step fails with
    `ERR_MODULE_NOT_FOUND`, which force-FAILS every top-level review's runtime
    gate (observed: nothing ever merged because every capture returned
    `ok: false / capture_failed`).

    Unlike game deps (which a ticket may legitimately change, so each worktree
    gets its own — see install_deps), harness tooling deps are identical across
    worktrees: tickets work on the game, not the harness. So a symlink to the
    main checkout's `harness/node_modules` is correct and free when that tree
    has Playwright installed. Broken or cyclic symlinks and links to an empty
    main `node_modules` are removed and re-established; when linking cannot
    provide Playwright, `pnpm install` runs under `harness/`. Idempotent and
    best-effort. The main harness dir is derived from HARNESS_PROGRESS_DIR
    (=<main>/harness/progress), which the dispatcher sets for every worker."""
    from harness.telemetry.progress import progress_dir
    root = Path(root)
    harness_dir = root / "harness"
    main_harness = progress_dir().parent
    src = main_harness / "node_modules"   # <main>/harness/node_modules
    dst = harness_dir / "node_modules"
    try:
        if _harness_playwright_ok(dst):
            return True
        if dst.exists() or dst.is_symlink():
            log(f"[worktree-setup] removing invalid harness node_modules at {dst}")
            _remove_harness_node_modules(dst)
        same_checkout = harness_dir.resolve() == main_harness.resolve()
        if not same_checkout and _harness_playwright_ok(src):
            dst.parent.mkdir(parents=True, exist_ok=True)
            dst.symlink_to(src, target_is_directory=True)
            log(f"[worktree-setup] linked harness deps {dst} -> {src}")
            if _harness_playwright_ok(dst):
                return True
            _remove_harness_node_modules(dst)
        if install_harness_deps(root, runner=runner, which=which):
            log(f"[worktree-setup] installed harness deps in {harness_dir}")
            return True
        log(f"[worktree-setup] harness deps still missing playwright under {dst}")
        return False
    except OSError as e:
        log(f"[worktree-setup] could not link harness deps: {e!r}")
        return False


__all__ = ["install_deps", "install_harness_deps", "link_harness_deps"]
