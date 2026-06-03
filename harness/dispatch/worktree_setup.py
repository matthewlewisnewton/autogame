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


def _harness_playwright_ok(modules_dir: Path) -> bool:
    """True when `import 'playwright'` from harness/ would resolve."""
    try:
        return (modules_dir / "playwright").exists()
    except OSError:
        return False


def _harness_install_dir(root: Path) -> Path | None:
    """Harness package root to run npm/pnpm in.

    Parallel workers set HARNESS_PROGRESS_DIR to the main checkout's progress
    dir; install there so link_harness_deps can symlink worktrees to one copy.
    Without that env var, install under the caller's worktree/root."""
    root = Path(root)
    from harness.telemetry.progress import progress_dir

    override = progress_dir().parent
    if (override / "package.json").exists():
        return override
    local = root / "harness"
    if (local / "package.json").exists() or (local / "pnpm-lock.yaml").exists():
        return local
    return None


def _remove_harness_node_modules(dst: Path) -> None:
    if dst.is_symlink() or dst.is_file():
        dst.unlink()
    elif dst.is_dir():
        shutil.rmtree(dst)
    elif dst.exists():
        dst.unlink()


def install_harness_deps(root: Path, *, npm: str = "npm", pnpm: str = "pnpm", timeout_s: int = 600,
                         runner: Callable = subprocess.run,
                         which: Callable = shutil.which) -> bool:
    """Install harness tooling deps (`playwright`, etc.) when missing.

    Uses pnpm when `pnpm-lock.yaml` exists, else `npm ci` / `npm install` when
    `package-lock.json` or `package.json` is present. Idempotent when playwright
    is already present. `runner`/`which` are injected for testing."""
    harness_dir = _harness_install_dir(root)
    if harness_dir is None:
        log(f"[worktree-setup] no harness/package.json under {root} — skipping harness install")
        return True
    modules = harness_dir / "node_modules"
    if _harness_playwright_ok(modules):
        return True
    # SERIALIZE the install. This targets the SHARED main harness dir (every
    # worktree links to its node_modules), so two workers running `pnpm install`
    # here at once corrupt each other's store/lockfile temp state → pnpm crashes
    # (rc=216), the install never completes, playwright never registers as ok, and
    # the ticket retries setup forever (observed hot-loop). A cross-process flock
    # makes it one-at-a-time; the double-check inside skips entirely once a peer
    # finished. Only the install contends on the lock — the fast skip-path above
    # never locks.
    from harness.concurrency.resource_lock import held
    try:
        with held("harness-install", timeout=timeout_s):
            if _harness_playwright_ok(modules):
                return True  # a peer installed while we waited for the lock
            # A SYMLINK at the main harness/node_modules is never valid — only
            # worktrees symlink (to this dir). A self-referential or broken symlink
            # here (observed: node_modules -> itself) makes pnpm crash rc=216, so
            # every worker fails setup and the dispatcher hot-loops. Remove it
            # before installing so a fresh real node_modules can be created.
            if modules.is_symlink():
                log(f"[worktree-setup] removing stray symlink at {modules} (main "
                    f"node_modules must be a real dir) before install")
                try:
                    modules.unlink()
                except OSError as e:
                    log(f"[worktree-setup] could not unlink {modules}: {e!r}")
            if (harness_dir / "pnpm-lock.yaml").exists():
                if which(pnpm) is None:
                    log(f"[worktree-setup] '{pnpm}' not on PATH — cannot install harness deps")
                    return False
                cmd = [pnpm, "install", "--frozen-lockfile"]
                pkg_mgr = "pnpm"
            elif (harness_dir / "package-lock.json").exists() or (harness_dir / "package.json").exists():
                if which(npm) is None:
                    log(f"[worktree-setup] '{npm}' not on PATH — cannot install harness deps")
                    return False
                lockfile = harness_dir / "package-lock.json"
                cmd = [npm, "ci"] if lockfile.exists() else [npm, "install"]
                pkg_mgr = "npm"
            else:
                log(f"[worktree-setup] no harness lockfile under {harness_dir} — skipping harness install")
                return True
            log(f"[worktree-setup] {' '.join(cmd)} in {harness_dir} (serialized) ...")
            try:
                proc = runner(cmd, cwd=str(harness_dir), capture_output=True, text=True, timeout=timeout_s)
            except (FileNotFoundError, subprocess.TimeoutExpired) as e:
                log(f"[worktree-setup] harness {pkg_mgr} install errored: {e!r}")
                return False
            if getattr(proc, "returncode", 1) != 0:
                tail = ((getattr(proc, "stderr", "") or getattr(proc, "stdout", "")) or "")[-400:]
                log(f"[worktree-setup] harness {pkg_mgr} install failed (rc={proc.returncode}): {tail}")
                return False
            if not _harness_playwright_ok(modules):
                log(f"[worktree-setup] harness install finished but {modules}/playwright is missing")
                return False
            return True
    except TimeoutError:
        # Held too long by a peer that's still installing — don't pile on; report
        # whether the install they're doing has already made playwright resolvable.
        log("[worktree-setup] harness-install lock busy >timeout — deferring to peer")
        return _harness_playwright_ok(modules)


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
    has Playwright installed. Broken or cyclic symlinks, regular files, and links
    to an empty main `node_modules` are removed and re-established; when linking
    cannot provide Playwright, `pnpm install` runs under `harness/`. Idempotent
    and best-effort. The main harness dir is derived from HARNESS_PROGRESS_DIR
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
            log(f"[worktree-setup] harness node_modules at {dst} is missing playwright — removing")
            _remove_harness_node_modules(dst)
        same_checkout = harness_dir.resolve() == main_harness.resolve()
        if not same_checkout and src.exists() and _harness_playwright_ok(src):
            dst.parent.mkdir(parents=True, exist_ok=True)
            dst.symlink_to(src, target_is_directory=True)
            if _harness_playwright_ok(dst):
                log(f"[worktree-setup] linked harness deps {dst} -> {src}")
                return True
            log(f"[worktree-setup] linked harness deps but playwright missing — removing link")
            _remove_harness_node_modules(dst)
        elif not same_checkout:
            if not src.exists():
                log(f"[worktree-setup] main harness node_modules missing at {src}")
            else:
                log(f"[worktree-setup] main harness node_modules at {src} has no playwright")
        log(f"[worktree-setup] falling back to local harness pnpm install")
        return install_harness_deps(root, runner=runner, which=which)
    except OSError as e:
        log(f"[worktree-setup] could not link harness deps: {e!r}")
        return install_harness_deps(root, runner=runner, which=which)


__all__ = ["install_deps", "install_harness_deps", "link_harness_deps"]
