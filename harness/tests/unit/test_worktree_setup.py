"""install_deps: per-worktree pnpm install (parallel-factory Phase 1)."""
from __future__ import annotations

import subprocess
from pathlib import Path

from harness.dispatch.worktree_setup import install_deps


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
