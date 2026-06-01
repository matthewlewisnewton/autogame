"""MergeQueue transaction: rebase → verify → ff-merge → close, else requeue."""
from __future__ import annotations

from harness.dispatch.dispatcher import WorkerHandle
from harness.dispatch.merge_queue import MergeQueue


class FakeWorktree:
    def __init__(self, name):
        self.branch = f"auto/{name}"
        self.root = f"/wt/{name}"
        self.removed = False

    def remove_worktree(self, **kw):
        self.removed = True
        return True


class FakeQueue:
    def __init__(self):
        self.closed = []
        self.requeued = []

    def close(self, tid, reason="done"):
        self.closed.append(tid)

    def requeue(self, tid, *, note=None):
        self.requeued.append(tid)


def _handle(name):
    return WorkerHandle(name, name, "composer", "medium", FakeWorktree(name), proc=object())


def _mq(queue, *, rebase=True, verify=True, merge=True):
    calls = {"rebase": 0, "verify": 0, "merge": 0}

    def _r(h):
        calls["rebase"] += 1
        return rebase

    def _v(root):
        calls["verify"] += 1
        return verify

    def _m(h):
        calls["merge"] += 1
        return merge

    mq = MergeQueue(main_repo=None, queue=queue, rebase=_r, verify=_v, merge=_m)
    return mq, calls


def test_happy_path_merges_closes_and_tears_down():
    q = FakeQueue()
    mq, calls = _mq(q)
    h = _handle("t1")
    mq.enqueue(h)
    assert mq.drain_one() is True
    assert q.closed == ["t1"]
    assert q.requeued == []
    assert h.worktree.removed
    assert calls == {"rebase": 1, "verify": 1, "merge": 1}


def test_rebase_conflict_requeues_without_touching_main():
    q = FakeQueue()
    mq, calls = _mq(q, rebase=False)
    h = _handle("t1")
    mq.enqueue(h)
    mq.drain_one()
    assert q.closed == []           # main untouched
    assert q.requeued == ["t1"]
    assert h.worktree.removed
    assert calls["merge"] == 0      # never attempted the merge
    assert calls["verify"] == 0     # short-circuited at rebase


def test_verify_failure_requeues():
    q = FakeQueue()
    mq, calls = _mq(q, verify=False)
    mq.enqueue(_handle("t1"))
    mq.drain_one()
    assert q.closed == [] and q.requeued == ["t1"]
    assert calls["merge"] == 0


def test_merge_failure_requeues():
    q = FakeQueue()
    mq, calls = _mq(q, merge=False)
    mq.enqueue(_handle("t1"))
    mq.drain_one()
    assert q.closed == [] and q.requeued == ["t1"]


def test_drain_all_fifo():
    q = FakeQueue()
    mq, _ = _mq(q)
    for n in ("t1", "t2", "t3"):
        mq.enqueue(_handle(n))
    assert mq.pending() == 3
    assert mq.drain_all() == 3
    assert q.closed == ["t1", "t2", "t3"]
    assert mq.drain_one() is False  # empty
