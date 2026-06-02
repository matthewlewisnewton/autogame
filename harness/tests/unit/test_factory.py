"""Factory launcher: reconcile + build_factory wiring (parallel-factory Phase 4)."""
from __future__ import annotations

from pathlib import Path

from harness.dispatch.factory import build_factory, default_registry, reconcile


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


def test_default_registry_health_file_roundtrip(tmp_path):
    hf = tmp_path / "agents_health.json"
    r1 = default_registry(hf)
    r1.disable("qwen", reason="quota")
    # a fresh registry (e.g. after restart / --enable path) sees it disabled
    r2 = default_registry(hf)
    assert "qwen" in r2.disabled_agents()
    r2.enable("qwen")
    assert "qwen" not in default_registry(hf).disabled_agents()
