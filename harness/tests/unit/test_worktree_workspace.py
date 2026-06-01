"""WorktreeWorkspace lifecycle + isolation (parallel-factory Phase 1)."""
from __future__ import annotations

import subprocess
from pathlib import Path

import pytest

from harness.workspace.ports import PortAllocation
from harness.workspace.repo import Repo, WorktreeWorkspace


def _git(root, *args):
    subprocess.run(["git", *args], cwd=str(root), check=True, capture_output=True, text=True)


def _make_repo(tmp_path: Path) -> Repo:
    _git(tmp_path, "init", "-q")
    _git(tmp_path, "config", "user.email", "t@e")
    _git(tmp_path, "config", "user.name", "T")
    (tmp_path / "game").mkdir()
    (tmp_path / "game" / "main.js").write_text("// base\n")
    _git(tmp_path, "add", ".")
    _git(tmp_path, "commit", "-q", "-m", "init")
    return Repo(root=tmp_path, ports=PortAllocation())


def test_create_isolates_then_removes(tmp_path):
    main = _make_repo(tmp_path)
    wt = WorktreeWorkspace.create(
        main, name="t1", ports=PortAllocation(3001, 5174),
        parent_dir=tmp_path / "wts",
    )
    try:
        # isolated dir, own branch + ports
        assert wt.root.exists() and wt.root != main.root
        assert wt.branch == "auto/t1"
        assert (wt.ports.game_server, wt.ports.vite) == (3001, 5174)
        # an edit + commit in the worktree must NOT touch main's working tree
        (wt.root / "game" / "main.js").write_text("// worker edit\n")
        wt.stage(["game/main.js"])
        wt.commit("worker change")
        assert (main.root / "game" / "main.js").read_text() == "// base\n"
        assert wt.head() != main.head()  # diverged onto auto/t1
    finally:
        wt.remove_worktree()
    assert not wt.root.exists()
    # branch is gone from the main checkout
    branches = subprocess.run(["git", "branch", "--list", "auto/t1"],
                              cwd=str(main.root), capture_output=True, text=True).stdout
    assert "auto/t1" not in branches


def test_two_worktrees_are_independent(tmp_path):
    main = _make_repo(tmp_path)
    a = WorktreeWorkspace.create(main, name="a", ports=PortAllocation(3001, 5174),
                                 parent_dir=tmp_path / "wts")
    b = WorktreeWorkspace.create(main, name="b", ports=PortAllocation(3002, 5175),
                                 parent_dir=tmp_path / "wts")
    try:
        assert a.root != b.root and a.branch != b.branch
        assert a.ports.vite != b.ports.vite
    finally:
        a.remove_worktree()
        b.remove_worktree()
