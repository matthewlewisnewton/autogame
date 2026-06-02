"""Factory launcher: reconcile + build_factory wiring (parallel-factory Phase 4)."""
from __future__ import annotations

from pathlib import Path

from harness.dispatch.factory import (
    build_factory, clean_orphan_worktrees, default_registry, reconcile,
)


class FakeQueue:
    def __init__(self, in_prog):
        self._in_prog = in_prog
        self.requeued = []
        self.closed = []

    def in_progress(self):
        return self._in_prog

    def requeue(self, tid, *, note=None):
        self.requeued.append(tid)

    def close(self, tid, reason="done"):
        self.closed.append(tid)


class FakeRepo:
    def __init__(self, root):
        self.root = root

    def run_git(self, *a, **k):
        return ""


class RecordingRepo:
    """Records git calls and replays canned output for the two read queries
    clean_orphan_worktrees makes (worktree list + branch list)."""
    def __init__(self, root, worktrees, branches):
        self.root = root
        self._worktrees = worktrees          # paths to report in `worktree list`
        self._branches = branches            # names to report in `branch --list`
        self.calls = []

    def run_git(self, *a, **k):
        self.calls.append(a)
        if a[:3] == ("worktree", "list", "--porcelain"):
            blocks = []
            for wt in self._worktrees:
                blocks.append(f"worktree {wt}\nHEAD deadbeef\nbranch refs/heads/auto/x\n")
            return "\n".join(blocks)
        if a[:2] == ("branch", "--list"):
            return "\n".join(self._branches)
        return ""


def test_clean_orphan_worktrees_removes_dirs_and_branches(tmp_path):
    repo = RecordingRepo(
        tmp_path,
        worktrees=[
            str(tmp_path),  # the main checkout itself — must NOT be removed
            "/home/x/.autogame-worktrees/137-foo",
            "/home/x/.autogame-worktrees/130-bar",
        ],
        branches=["  auto/137-foo", "* main", "  auto/130-bar"],
    )
    n = clean_orphan_worktrees(repo)
    assert n == 2  # only the two .autogame-worktrees entries, not main
    removes = [c for c in repo.calls if c[:3] == ("worktree", "remove", "--force")]
    assert {c[3] for c in removes} == {
        "/home/x/.autogame-worktrees/137-foo",
        "/home/x/.autogame-worktrees/130-bar",
    }
    deletes = {c[2] for c in repo.calls if c[:2] == ("branch", "-D")}
    assert deletes == {"auto/137-foo", "auto/130-bar"}  # main branch untouched


def test_reconcile_resets_orphans(tmp_path):
    q = FakeQueue([{"id": "bd-1", "title": "t1"}, {"id": "bd-2", "title": "t2"}])
    n = reconcile(q, FakeRepo(tmp_path))
    assert n == 2
    assert q.requeued == ["bd-1", "bd-2"]


def test_reconcile_noop_when_nothing_in_progress(tmp_path):
    q = FakeQueue([])
    assert reconcile(q, FakeRepo(tmp_path)) == 0
    assert q.requeued == []


def test_reconcile_closes_merged_unclosed_instead_of_requeue(tmp_path):
    from harness.dispatch.merge_queue import MERGED_UNCLOSED
    (tmp_path / MERGED_UNCLOSED).write_text("bd-merged\n")
    q = FakeQueue([{"id": "bd-merged", "title": "t-merged"},
                   {"id": "bd-orphan", "title": "t-orphan"}])
    n = reconcile(q, FakeRepo(tmp_path))
    # only the genuine orphan is reset; the merged-unclosed one is closed
    assert n == 1
    assert q.requeued == ["bd-orphan"]
    assert q.closed == ["bd-merged"]
    # the durable record is cleared after recovery
    assert not (tmp_path / MERGED_UNCLOSED).exists()


def test_build_factory_wires_components(tmp_path):
    disp, mq, queue, registry = build_factory(tmp_path, workers=3)
    # merge queue wired into the dispatcher
    assert disp.on_pass == mq.enqueue
    assert disp.merge_drain == mq.drain_one
    # one port pair per worker, non-overlapping
    assert len(disp.ports_pool) == 3
    vites = [p.vite for p in disp.ports_pool]
    assert len(set(vites)) == 3
    # default lane config present with the agreed caps
    snap = registry.snapshot()
    assert snap["qwen"]["max_concurrency"] == 1
    assert snap["composer_write"]["max_concurrency"] == 3
    assert "hard" in snap["gpt5_extra_write"]["eligible"]
    assert snap["gpt5_extra_write"]["max_concurrency"] == 1
    # claude opted in for medium/hard only, at concurrency 1
    assert snap["claude"]["max_concurrency"] == 1
    assert set(snap["claude"]["eligible"]) == {"medium", "hard"}


def test_default_registry_health_file_roundtrip(tmp_path):
    hf = tmp_path / "agents_health.json"
    r1 = default_registry(hf)
    r1.disable("qwen", reason="quota")
    # a fresh registry (e.g. after restart / --enable path) sees it disabled
    r2 = default_registry(hf)
    assert "qwen" in r2.disabled_agents()
    r2.enable("qwen")
    assert "qwen" not in default_registry(hf).disabled_agents()
