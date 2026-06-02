"""MergeQueue transaction: rebase → verify → ff-merge → close, else requeue."""
from __future__ import annotations

from harness.dispatch.dispatcher import WorkerHandle
from harness.dispatch.merge_queue import MERGED_UNCLOSED, MergeQueue


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


class _HeadRepo:
    """Fake main repo whose HEAD can advance, to exercise the ff-retry path."""
    root = "/main"

    def __init__(self, heads):
        # heads[i] is the HEAD returned on the i-th rev-parse call
        self._heads = list(heads)
        self._i = 0

    def run_git(self, *args, **kw):
        if args[:2] == ("rev-parse", "HEAD"):
            h = self._heads[min(self._i, len(self._heads) - 1)]
            self._i += 1
            return h
        return ""


def test_ff_retry_succeeds_after_main_advances_under_verify():
    """main moves during verify → first ff fails; we re-rebase and the retry
    fast-forwards. Branch merges, closes, and we verify the new (moved) main."""
    q = FakeQueue()
    calls = {"rebase": 0, "verify": 0, "merge": 0}
    merge_results = iter([False, True])  # ff fails once, then succeeds

    mq = MergeQueue(
        main_repo=_HeadRepo(["sha_old", "sha_new", "sha_new"]),
        queue=q,
        rebase=lambda h: (calls.__setitem__("rebase", calls["rebase"] + 1) or True),
        verify=lambda root: (calls.__setitem__("verify", calls["verify"] + 1) or True),
        merge=lambda h: (calls.__setitem__("merge", calls["merge"] + 1) or next(merge_results)),
    )
    h = _handle("t1")
    mq.enqueue(h, record=False)
    assert mq.drain_one() is True
    assert q.closed == ["t1"] and q.requeued == []
    assert h.worktree.removed
    assert calls["rebase"] == 2          # re-rebased onto the moved main
    assert calls["merge"] == 2           # retried the ff
    assert calls["verify"] == 2          # re-verified because main HEAD changed


def test_ff_persistent_failure_rejects_after_bounded_attempts():
    from harness.dispatch.merge_queue import MERGE_FF_ATTEMPTS
    q = FakeQueue()
    calls = {"rebase": 0, "merge": 0}
    mq = MergeQueue(
        main_repo=_HeadRepo(["a", "b", "c", "d"]),
        queue=q,
        rebase=lambda h: (calls.__setitem__("rebase", calls["rebase"] + 1) or True),
        verify=lambda root: True,
        merge=lambda h: (calls.__setitem__("merge", calls["merge"] + 1) or False),
    )
    mq.enqueue(_handle("t1"), record=False)
    mq.drain_one()
    assert q.closed == [] and q.requeued == ["t1"]   # safe reject, main untouched
    assert calls["rebase"] == MERGE_FF_ATTEMPTS
    assert calls["merge"] == MERGE_FF_ATTEMPTS


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


class _Repo:
    def __init__(self, root):
        self.root = root


class _CloseFailsQueue(FakeQueue):
    def close(self, tid, reason="done"):
        raise RuntimeError("dolt locked")


def test_close_failure_after_merge_records_durably_not_requeue(tmp_path, monkeypatch):
    """A successful merge whose `bd close` keeps failing must NOT requeue (the
    code is already on main) — it records the id for reconcile to close."""
    monkeypatch.setattr("harness.dispatch.merge_queue.time.sleep", lambda *_: None)
    q = _CloseFailsQueue()
    mq, calls = _mq(q)
    mq.main_repo = _Repo(tmp_path)
    h = _handle("t1")
    mq.enqueue(h)
    mq.drain_one()
    assert q.requeued == []                       # NOT requeued — already merged
    assert h.worktree.removed                     # worktree still torn down
    recorded = (tmp_path / MERGED_UNCLOSED).read_text().split()
    assert recorded == ["t1"]                     # durably recorded for reconcile


def test_drain_one_never_raises_on_merge_crash():
    """A merge step that throws must NOT propagate — it would crash the
    dispatcher's tick loop (this actually happened: _default_verify called
    run_vitest with a bad signature). drain_one swallows it and requeues."""
    q = FakeQueue()

    def boom_verify(root):
        raise TypeError("run_vitest() missing 1 required keyword-only argument")

    mq = MergeQueue(main_repo=None, queue=q,
                    rebase=lambda h: True, verify=boom_verify, merge=lambda h: True)
    h = _handle("t1")
    mq.enqueue(h)
    assert mq.drain_one() is True   # processed without raising
    assert q.requeued == ["t1"]     # requeued, not merged
    assert q.closed == []
    assert h.worktree.removed


def test_enqueue_records_pending_and_drain_clears_it(tmp_path):
    """A passed branch is durably recorded in PENDING_MERGE on enqueue (so a
    restart can recover it) and the record is cleared once it merges + closes."""
    from harness.dispatch.merge_queue import read_pending
    q = FakeQueue()
    mq, _ = _mq(q)
    mq.main_repo = _Repo(tmp_path)
    mq.enqueue(_handle("t1"))
    assert read_pending(tmp_path) == [("t1", "t1")]
    mq.drain_one()
    assert q.closed == ["t1"]
    assert read_pending(tmp_path) == []   # cleared after successful merge+close


def test_reject_clears_pending(tmp_path):
    """A rejected merge (e.g. verify failure) is requeued to ready, so its
    pending-merge record must be cleared — a fresh worker pass re-records it."""
    from harness.dispatch.merge_queue import read_pending
    q = FakeQueue()
    mq, _ = _mq(q, verify=False)
    mq.main_repo = _Repo(tmp_path)
    mq.enqueue(_handle("t1"))
    assert read_pending(tmp_path) == [("t1", "t1")]
    mq.drain_one()
    assert q.requeued == ["t1"]
    assert read_pending(tmp_path) == []


def test_reenqueue_with_record_false_does_not_duplicate(tmp_path):
    """reconcile's rebuild re-enqueues already-recorded branches with
    record=False so the durable file isn't double-written."""
    from harness.dispatch.merge_queue import read_pending, _record_pending
    _record_pending(tmp_path, "t1", "t1")           # simulate prior run's record
    q = FakeQueue()
    mq, _ = _mq(q)
    mq.main_repo = _Repo(tmp_path)
    mq.enqueue(_handle("t1"), record=False)
    assert read_pending(tmp_path) == [("t1", "t1")]  # still exactly one entry


def test_drain_all_fifo():
    q = FakeQueue()
    mq, _ = _mq(q)
    for n in ("t1", "t2", "t3"):
        mq.enqueue(_handle(n))
    assert mq.pending() == 3
    assert mq.drain_all() == 3
    assert q.closed == ["t1", "t2", "t3"]
    assert mq.drain_one() is False  # empty
