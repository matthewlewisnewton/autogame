"""_rebase_onto_integration — the round-boundary incremental rebase (autogame-6xs).

Drives the helper with a scripted fake repo (no real git): verifies it rebases
cleanly when behind, advances base_ref to the integration head, and on a dirty
tree / conflict / missing ref leaves the branch exactly where it was.
"""
from __future__ import annotations

from harness.pipelines.ticket import _rebase_onto_integration


class FakeRepo:
    """Scripts git responses by argv so we can exercise each branch of the helper."""

    def __init__(self, *, has_main=True, dirty=False, behind="2",
                 rebase_raises=False, main_head="newmainsha"):
        self.has_main = has_main
        self.dirty = dirty
        self.behind = behind
        self.rebase_raises = rebase_raises
        self.main_head = main_head
        self.calls = []

    def run_git(self, *args, **kw):
        self.calls.append(tuple(args))
        if args[:2] == ("rev-parse", "--verify"):
            if not self.has_main:
                raise RuntimeError("unknown revision")
            return "mainsha\n"
        if args == ("status", "--porcelain"):
            return "M game/foo.js\n" if self.dirty else "\n"
        if args[0] == "rev-list" and args[1] == "--count":
            return self.behind + "\n"
        if args == ("rebase", "--abort"):
            return ""
        if args[0] == "rebase":
            if self.rebase_raises:
                raise RuntimeError("CONFLICT")
            return ""
        if args == ("rev-parse", "main"):
            return self.main_head + "\n"
        return ""

    def rebased(self):
        return any(a == ("rebase", "main") for a in self.calls)


def test_rebase_noop_when_not_behind():
    repo = FakeRepo(behind="0")
    assert _rebase_onto_integration(repo, "base") == "base"
    assert not repo.rebased()


def test_rebase_advances_base_when_clean():
    repo = FakeRepo(behind="3", main_head="deadbeef")
    assert _rebase_onto_integration(repo, "base") == "deadbeef"
    assert repo.rebased()


def test_rebase_skips_dirty_tree():
    repo = FakeRepo(behind="3", dirty=True)
    assert _rebase_onto_integration(repo, "base") == "base"
    assert not repo.rebased()


def test_rebase_aborts_and_keeps_base_on_conflict():
    repo = FakeRepo(behind="3", rebase_raises=True)
    assert _rebase_onto_integration(repo, "base") == "base"
    assert ("rebase", "--abort") in repo.calls


def test_rebase_noop_without_integration_ref():
    repo = FakeRepo(has_main=False)
    assert _rebase_onto_integration(repo, "base") == "base"
    assert not repo.rebased()
