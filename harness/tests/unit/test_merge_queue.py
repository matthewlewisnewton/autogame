"""MergeQueue transaction: rebase → verify → ff-merge → close, else requeue."""
from __future__ import annotations

import subprocess
import types
from pathlib import Path

import pytest

from harness.dispatch.dispatcher import WorkerHandle
from harness.dispatch.merge_queue import MERGED_UNCLOSED, MergeQueue, _default_resolve


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


def test_rebase_conflict_resolved_then_merges():
    """A rebase conflict is handed to the context-aware resolver (not discarded);
    on success the integrated tree is re-verified and ff-merged."""
    q = FakeQueue()
    calls = {"rebase": 0, "resolve": 0, "verify": 0, "merge": 0}
    mq = MergeQueue(
        main_repo=None, queue=q,
        rebase=lambda h: (calls.__setitem__("rebase", calls["rebase"] + 1) or False),
        resolve=lambda h: (calls.__setitem__("resolve", calls["resolve"] + 1) or True),
        verify=lambda root: (calls.__setitem__("verify", calls["verify"] + 1) or True),
        merge=lambda h: (calls.__setitem__("merge", calls["merge"] + 1) or True),
    )
    h = _handle("t1")
    mq.enqueue(h, record=False)
    assert mq.drain_one() is True
    assert q.closed == ["t1"] and q.requeued == []
    assert h.worktree.removed
    assert calls["resolve"] == 1          # conflict went to the resolver
    assert calls["verify"] == 1           # integrated tree re-verified
    assert calls["merge"] == 1            # then ff-merged


def test_rebase_conflict_resolver_fails_requeues():
    """Resolver can't integrate → safe reject + requeue (main untouched), and we
    never verify or ff."""
    q = FakeQueue()
    calls = {"verify": 0, "merge": 0}
    mq = MergeQueue(
        main_repo=None, queue=q,
        rebase=lambda h: False,
        resolve=lambda h: False,
        verify=lambda root: (calls.__setitem__("verify", calls["verify"] + 1) or True),
        merge=lambda h: (calls.__setitem__("merge", calls["merge"] + 1) or True),
    )
    mq.enqueue(_handle("t1"), record=False)
    mq.drain_one()
    assert q.closed == [] and q.requeued == ["t1"]
    assert calls["verify"] == 0 and calls["merge"] == 0


def test_no_resolver_rebase_conflict_still_rejects():
    """With no resolver wired (resolve=None), a rebase conflict rejects as before
    — the resolver is purely additive."""
    q = FakeQueue()
    mq = MergeQueue(main_repo=None, queue=q, rebase=lambda h: False,
                    verify=lambda r: True, merge=lambda h: True)  # resolve defaults None
    mq.enqueue(_handle("t1"), record=False)
    mq.drain_one()
    assert q.closed == [] and q.requeued == ["t1"]


def test_resolve_then_ff_fails_reintegrates_via_resolver_not_rebase():
    """After a resolve, if the ff fails (main advanced again) we re-integrate by
    RE-RESOLVING (merging the newer main), never rebasing — a rebase would drop
    the resolution commit."""
    q = FakeQueue()
    calls = {"rebase": 0, "resolve": 0, "merge": 0}
    merge_seq = iter([False, True])  # ff fails once, then succeeds
    mq = MergeQueue(
        main_repo=None, queue=q,
        rebase=lambda h: (calls.__setitem__("rebase", calls["rebase"] + 1) or False),
        resolve=lambda h: (calls.__setitem__("resolve", calls["resolve"] + 1) or True),
        verify=lambda root: True,
        merge=lambda h: (calls.__setitem__("merge", calls["merge"] + 1) or next(merge_seq)),
    )
    h = _handle("t1")
    mq.enqueue(h, record=False)
    assert mq.drain_one() is True
    assert q.closed == ["t1"]
    assert calls["rebase"] == 1           # only the first attempt rebases
    assert calls["resolve"] == 2          # resolved, then re-resolved on re-integration
    assert calls["merge"] == 2


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


# --- _default_resolve: real-git integration (merge → resolve → commit/abort) --- #
import os

_GIT_ENV = {
    **os.environ,
    "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@t",
    "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@t",
}


class _RealRepo:
    """Minimal Repo-like wrapper over a real git checkout (matches the run_git
    interface _default_resolve uses)."""
    def __init__(self, root, branch="main"):
        self.root = Path(root)
        self.branch = branch

    def run_git(self, *args, check=True, capture=True):
        r = subprocess.run(["git", *args], cwd=str(self.root),
                           capture_output=True, text=True, env=_GIT_ENV)
        if check and r.returncode != 0:
            raise subprocess.CalledProcessError(r.returncode, ("git", *args),
                                                r.stdout, r.stderr)
        return r.stdout


def _fake_roster(resolve_fn):
    """A roster whose merge_resolve role runs `resolve_fn(workspace, prompt_vars)`
    (the stand-in agent) and reports acceptance from its truthy return."""
    class _Role:
        def execute(self, *, workspace, prompt_vars, artifacts_dir, telemetry=None):
            accepted = resolve_fn(workspace, prompt_vars)
            who = types.SimpleNamespace(name="fake/composer") if accepted else None
            return types.SimpleNamespace(
                accepted_by=who,
                final=types.SimpleNamespace(stdout="", rc=0 if accepted else 2))
    class _Roster:
        def role(self, name):
            assert name == "merge_resolve"
            return _Role()
    return _Roster()


def _init_repo(tmp_path):
    repo = tmp_path / "repo"
    repo.mkdir()
    _RealRepo(repo).run_git("init", "-b", "main")
    (repo / "game").mkdir()
    return repo


def _commit(repo, branch_msg):
    r = _RealRepo(repo)
    r.run_git("add", "-A")
    r.run_git("commit", "-m", branch_msg)


def _real_handle(name, wt):
    return WorkerHandle(name, name, "composer", "medium", wt, proc=None)


def test_default_resolve_resolves_real_conflict_and_commits(tmp_path):
    repo = _init_repo(tmp_path)
    (repo / "game" / "f.js").write_text("base\n")
    _commit(repo, "base")
    _RealRepo(repo).run_git("checkout", "-b", "auto/x")
    (repo / "game" / "f.js").write_text("branch change\n")
    _commit(repo, "branch: do X")
    _RealRepo(repo).run_git("checkout", "main")
    (repo / "game" / "f.js").write_text("main change\n")
    _commit(repo, "main: do Y")
    _RealRepo(repo).run_git("checkout", "auto/x")  # merging main now conflicts

    def agent(ws, pv):
        assert "f.js" in pv["CONFLICT_FILES"]              # got the conflict context
        assert "do X" in pv["CHANGE_COMMITS"]              # got the change's intent
        (Path(ws.root) / "game" / "f.js").write_text("combined: X over Y\n")
        return True

    wt = _RealRepo(repo, "auto/x")
    ok = _default_resolve(_RealRepo(repo, "main"), _fake_roster(agent), _real_handle("x", wt))
    assert ok is True
    txt = (repo / "game" / "f.js").read_text()
    assert "<<<<<<<" not in txt and txt.strip() == "combined: X over Y"
    # main is now an ancestor of auto/x → the subsequent --ff-only will work
    assert _RealRepo(repo).run_git("merge-base", "main", "auto/x").strip() == \
           _RealRepo(repo).run_git("rev-parse", "main").strip()
    assert _RealRepo(repo).run_git("status", "--porcelain").strip() == ""  # merge committed


def test_default_resolve_clean_merge_does_not_invoke_agent(tmp_path):
    repo = _init_repo(tmp_path)
    (repo / "game" / "a.js").write_text("a\n")
    (repo / "game" / "b.js").write_text("b\n")
    _commit(repo, "base")
    _RealRepo(repo).run_git("checkout", "-b", "auto/x")
    (repo / "game" / "a.js").write_text("a changed by branch\n")
    _commit(repo, "branch")
    _RealRepo(repo).run_git("checkout", "main")
    (repo / "game" / "b.js").write_text("b changed by main\n")  # different file → no conflict
    _commit(repo, "main")
    _RealRepo(repo).run_git("checkout", "auto/x")

    def agent(ws, pv):
        raise AssertionError("agent must not run on a clean merge")

    wt = _RealRepo(repo, "auto/x")
    ok = _default_resolve(_RealRepo(repo, "main"), _fake_roster(agent), _real_handle("x", wt))
    assert ok is True
    assert _RealRepo(repo).run_git("merge-base", "main", "auto/x").strip() == \
           _RealRepo(repo).run_git("rev-parse", "main").strip()


def test_default_resolve_unresolved_aborts_leaving_clean_tree(tmp_path):
    repo = _init_repo(tmp_path)
    (repo / "game" / "f.js").write_text("base\n")
    _commit(repo, "base")
    _RealRepo(repo).run_git("checkout", "-b", "auto/x")
    (repo / "game" / "f.js").write_text("branch change\n")
    _commit(repo, "branch")
    _RealRepo(repo).run_git("checkout", "main")
    (repo / "game" / "f.js").write_text("main change\n")
    _commit(repo, "main")
    _RealRepo(repo).run_git("checkout", "auto/x")
    branch_tip = _RealRepo(repo).run_git("rev-parse", "HEAD").strip()

    # Agent claims success but leaves the conflict markers in place.
    ok = _default_resolve(_RealRepo(repo, "main"),
                          _fake_roster(lambda ws, pv: True), _real_handle("x", _RealRepo(repo, "auto/x")))
    assert ok is False
    # merge aborted → clean tree, no MERGE_HEAD, branch tip unmoved (main untouched too)
    assert _RealRepo(repo).run_git("status", "--porcelain").strip() == ""
    assert _RealRepo(repo).run_git("rev-parse", "HEAD").strip() == branch_tip
