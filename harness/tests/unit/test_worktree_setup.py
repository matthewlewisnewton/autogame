"""install_deps: per-worktree pnpm install (parallel-factory Phase 1)."""
from __future__ import annotations

import subprocess
from pathlib import Path

from harness.dispatch.worktree_setup import install_deps, install_harness_deps, link_harness_deps


class _Result:
    def __init__(self, rc, stderr=""):
        self.returncode = rc
        self.stderr = stderr
        self.stdout = ""


def test_skips_when_no_lockfile(tmp_path):
    calls = []
    ok = install_deps(tmp_path, runner=lambda *a, **k: calls.append(a) or _Result(0),
                      which=lambda _: "/usr/bin/pnpm")
    assert ok is True
    assert calls == []  # nothing to install → no runner call


def test_fails_when_pnpm_missing(tmp_path):
    (tmp_path / "pnpm-lock.yaml").write_text("lockfileVersion: '9.0'\n")
    ok = install_deps(tmp_path, which=lambda _: None,
                      runner=lambda *a, **k: _Result(0))
    assert ok is False


def test_runs_frozen_lockfile_install(tmp_path):
    (tmp_path / "pnpm-lock.yaml").write_text("lockfileVersion: '9.0'\n")
    seen = {}

    def runner(cmd, **kw):
        seen["cmd"] = cmd
        seen["cwd"] = kw.get("cwd")
        return _Result(0)

    ok = install_deps(tmp_path, runner=runner, which=lambda _: "/usr/bin/pnpm")
    assert ok is True
    assert seen["cmd"] == ["pnpm", "install", "--frozen-lockfile"]
    assert seen["cwd"] == str(tmp_path)


def test_installs_in_game_subdir_when_lockfile_is_there(tmp_path):
    # this repo's pnpm workspace root is game/, not the worktree root
    game = tmp_path / "game"
    game.mkdir()
    (game / "pnpm-lock.yaml").write_text("lockfileVersion: '9.0'\n")
    seen = {}

    def runner(cmd, **kw):
        seen["cwd"] = kw.get("cwd")
        return _Result(0)

    ok = install_deps(tmp_path, runner=runner, which=lambda _: "/usr/bin/pnpm")
    assert ok is True
    assert seen["cwd"] == str(game)


def test_reports_install_failure(tmp_path):
    (tmp_path / "pnpm-lock.yaml").write_text("lockfileVersion: '9.0'\n")
    ok = install_deps(tmp_path, which=lambda _: "/usr/bin/pnpm",
                      runner=lambda *a, **k: _Result(1, stderr="ERR_PNPM_OUTDATED_LOCKFILE"))
    assert ok is False


def test_handles_timeout(tmp_path):
    (tmp_path / "pnpm-lock.yaml").write_text("lockfileVersion: '9.0'\n")

    def boom(*a, **k):
        raise subprocess.TimeoutExpired(cmd="pnpm", timeout=1)

    ok = install_deps(tmp_path, which=lambda _: "/usr/bin/pnpm", runner=boom)
    assert ok is False


def test_install_harness_deps_runs_npm_ci_when_playwright_missing(tmp_path, monkeypatch):
    harness = tmp_path / "harness"
    harness.mkdir()
    (harness / "package.json").write_text('{"dependencies":{"playwright":"^1.60.0"}}')
    (harness / "package-lock.json").write_text("{}")
    monkeypatch.setenv("HARNESS_PROGRESS_DIR", str(harness / "progress"))
    seen = {}

    def runner(cmd, **kw):
        seen["cmd"] = cmd
        seen["cwd"] = kw.get("cwd")
        (harness / "node_modules" / "playwright").mkdir(parents=True)
        return _Result(0)

    ok = install_harness_deps(tmp_path, runner=runner, which=lambda _: "/usr/bin/npm")
    assert ok is True
    assert seen["cmd"] == ["npm", "ci"]
    assert seen["cwd"] == str(harness)


def test_install_harness_deps_noop_when_playwright_present(tmp_path, monkeypatch):
    harness = tmp_path / "harness"
    (harness / "node_modules" / "playwright").mkdir(parents=True)
    (harness / "package.json").write_text("{}")
    monkeypatch.setenv("HARNESS_PROGRESS_DIR", str(harness / "progress"))
    calls = []
    ok = install_harness_deps(tmp_path, runner=lambda *a, **k: calls.append(1) or _Result(0),
                              which=lambda _: "/usr/bin/npm")
    assert ok is True
    assert calls == []


def test_link_harness_deps_symlinks_to_main(tmp_path, monkeypatch):
    """In a worktree, harness/node_modules is symlinked at the main checkout's so
    `node harness/screenshot.mjs` can import playwright (else capture fails)."""
    main = tmp_path / "main"
    (main / "harness" / "node_modules" / "playwright").mkdir(parents=True)
    monkeypatch.setenv("HARNESS_PROGRESS_DIR", str(main / "harness" / "progress"))
    wt = tmp_path / "wt"
    (wt / "harness").mkdir(parents=True)  # worktree has harness SOURCE, no node_modules
    assert link_harness_deps(wt) is True
    dst = wt / "harness" / "node_modules"
    assert dst.is_symlink()
    assert (dst / "playwright").exists()  # resolves through the link to main's


def test_install_harness_deps_runs_in_harness_subdir(tmp_path):
    harness = tmp_path / "harness"
    harness.mkdir()
    (harness / "pnpm-lock.yaml").write_text("lockfileVersion: '9.0'\n")
    seen = {}

    def runner(cmd, **kw):
        seen["cmd"] = cmd
        seen["cwd"] = kw.get("cwd")
        (harness / "node_modules" / "playwright").mkdir(parents=True)
        return _Result(0)

    ok = install_harness_deps(tmp_path, runner=runner, which=lambda _: "/usr/bin/pnpm")
    assert ok is True
    assert seen["cmd"] == ["pnpm", "install", "--frozen-lockfile"]
    assert seen["cwd"] == str(harness)


def test_link_harness_deps_removes_broken_symlink_and_installs(tmp_path, monkeypatch):
    """Self-referential or missing-target symlinks must not short-circuit setup."""
    main = tmp_path / "main"
    (main / "harness" / "progress").mkdir(parents=True)
    monkeypatch.setenv("HARNESS_PROGRESS_DIR", str(main / "harness" / "progress"))
    wt = tmp_path / "wt"
    harness = wt / "harness"
    harness.mkdir(parents=True)
    (harness / "pnpm-lock.yaml").write_text("lockfileVersion: '9.0'\n")
    broken = harness / "node_modules"
    broken.symlink_to("node_modules")  # self-referential — playwright never resolves
    installs = []

    def runner(cmd, **kw):
        installs.append(kw.get("cwd"))
        (harness / "node_modules" / "playwright").mkdir(parents=True)
        return _Result(0)

    assert link_harness_deps(wt, runner=runner, which=lambda _: "/usr/bin/pnpm") is True
    assert installs == [str(harness)]
    assert (broken / "playwright").exists()


def test_link_harness_deps_idempotent_and_noop_for_main(tmp_path, monkeypatch):
    """Re-linking is a no-op, and a serial (non-worktree) run where the harness
    dir already IS the main one does nothing destructive."""
    main = tmp_path / "main"
    (main / "harness" / "node_modules" / "playwright").mkdir(parents=True)
    monkeypatch.setenv("HARNESS_PROGRESS_DIR", str(main / "harness" / "progress"))
    # serial run: target dir == source dir → no-op, returns True
    assert link_harness_deps(main) is True
    assert not (main / "harness" / "node_modules").is_symlink()  # untouched, still real
    # worktree: first link succeeds, second is a no-op
    wt = tmp_path / "wt"
    (wt / "harness").mkdir(parents=True)
    assert link_harness_deps(wt) is True
    assert link_harness_deps(wt) is True
    assert (wt / "harness" / "node_modules").is_symlink()


def test_link_harness_deps_replaces_broken_symlink(tmp_path, monkeypatch):
    """A cyclic or dangling harness/node_modules symlink is removed and replaced
  so Playwright resolves through a valid link to main."""
    main = tmp_path / "main"
    (main / "harness" / "node_modules" / "playwright").mkdir(parents=True)
    monkeypatch.setenv("HARNESS_PROGRESS_DIR", str(main / "harness" / "progress"))
    wt = tmp_path / "wt"
    (wt / "harness").mkdir(parents=True)
    dst = wt / "harness" / "node_modules"
    dst.symlink_to(".")  # cyclic — (dst / "playwright").exists() is false / errors
    assert link_harness_deps(wt) is True
    assert dst.is_symlink()
    assert (dst / "playwright").exists()


def test_link_harness_deps_installs_when_main_missing_playwright(tmp_path, monkeypatch):
    """When main has no harness node_modules, fall back to pnpm install in the worktree."""
    main = tmp_path / "main"
    (main / "harness" / "progress").mkdir(parents=True)
    monkeypatch.setenv("HARNESS_PROGRESS_DIR", str(main / "harness" / "progress"))
    wt = tmp_path / "wt"
    harness = wt / "harness"
    harness.mkdir(parents=True)
    (harness / "package.json").write_text('{"private":true}')
    (harness / "pnpm-lock.yaml").write_text("lockfileVersion: '9.0'\n")
    installed = []

    def runner(cmd, **kw):
        if cmd[:2] == ["pnpm", "install"]:
            nm = Path(kw["cwd"]) / "node_modules" / "playwright"
            nm.mkdir(parents=True)
            installed.append(kw["cwd"])
        return _Result(0)

    assert link_harness_deps(wt, runner=runner, which=lambda _: "/usr/bin/pnpm") is True
    assert installed == [str(harness)]
    assert (harness / "node_modules" / "playwright").exists()
    assert not (harness / "node_modules").is_symlink()
