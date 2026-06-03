"""Factory launcher: reconcile + build_factory wiring (parallel-factory Phase 4)."""
from __future__ import annotations

from pathlib import Path

from harness.dispatch.factory import (
    DEFAULT_WORKERS, build_factory, clean_orphan_worktrees, default_registry,
    load_factory_config, reconcile,
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


class RecoverRepo:
    """Reports given `auto/*` branches present and serves worktree listings,
    recording branch deletes / worktree removes so a test can assert that a
    passed-branch-awaiting-merge is PRESERVED across reconcile."""
    def __init__(self, root, branches, worktrees=()):
        self.root = root
        self._branches = branches
        self._worktrees = worktrees
        self.deleted_branches = []
        self.removed_worktrees = []

    def run_git(self, *a, **k):
        if a[:2] == ("branch", "--list"):
            return "\n".join(self._branches)
        if a[:3] == ("worktree", "list", "--porcelain"):
            return "\n".join(f"worktree {wt}\nHEAD x\nbranch refs/heads/auto/x\n"
                             for wt in self._worktrees)
        if a[:2] == ("branch", "-D"):
            self.deleted_branches.append(a[2])
        if a[:3] == ("worktree", "remove", "--force"):
            self.removed_worktrees.append(a[3])
        return ""


def test_reconcile_resets_orphans(tmp_path):
    q = FakeQueue([{"id": "bd-1", "title": "t1"}, {"id": "bd-2", "title": "t2"}])
    n, recoverable = reconcile(q, FakeRepo(tmp_path))
    assert n == 2 and recoverable == []
    assert q.requeued == ["bd-1", "bd-2"]


def test_reconcile_noop_when_nothing_in_progress(tmp_path):
    q = FakeQueue([])
    n, recoverable = reconcile(q, FakeRepo(tmp_path))
    assert n == 0 and recoverable == []
    assert q.requeued == []


def test_reconcile_closes_merged_unclosed_instead_of_requeue(tmp_path):
    from harness.dispatch.merge_queue import MERGED_UNCLOSED
    (tmp_path / MERGED_UNCLOSED).write_text("bd-merged\n")
    q = FakeQueue([{"id": "bd-merged", "title": "t-merged"},
                   {"id": "bd-orphan", "title": "t-orphan"}])
    n, _ = reconcile(q, FakeRepo(tmp_path))
    # only the genuine orphan is reset; the merged-unclosed one is closed
    assert n == 1
    assert q.requeued == ["bd-orphan"]
    assert q.closed == ["bd-merged"]
    # the durable record is cleared after recovery
    assert not (tmp_path / MERGED_UNCLOSED).exists()


def test_reconcile_recovers_passed_branch_pending_merge(tmp_path):
    """A branch that passed review (in PENDING_MERGE) whose branch + worktree
    still exist is PRESERVED (not requeued, not deleted) and returned for the
    merge queue to recover — not re-run from scratch."""
    from harness.dispatch.merge_queue import PENDING_MERGE
    root = tmp_path / "main"
    root.mkdir()
    wt = tmp_path / ".autogame-worktrees" / "135-foo"
    wt.mkdir(parents=True)
    (root / PENDING_MERGE).write_text("bd-pass\t135-foo\n")
    q = FakeQueue([{"id": "bd-pass", "title": "135-foo"},
                   {"id": "bd-orphan", "title": "t-orphan"}])
    repo = RecoverRepo(root, branches=["  auto/135-foo", "* main"],
                       worktrees=[str(wt)])
    n, recoverable = reconcile(q, repo)
    assert recoverable == [("bd-pass", "135-foo")]
    assert n == 1 and q.requeued == ["bd-orphan"]   # passed branch NOT requeued
    assert "auto/135-foo" not in repo.deleted_branches  # branch preserved
    assert str(wt) not in repo.removed_worktrees        # worktree preserved


def test_reconcile_drops_stale_pending_then_resets(tmp_path):
    """A PENDING_MERGE entry whose branch/worktree are gone is unrecoverable: it
    is dropped from the file and the bead reset to ready like any other orphan."""
    from harness.dispatch.merge_queue import PENDING_MERGE
    root = tmp_path / "main"
    root.mkdir()
    (root / PENDING_MERGE).write_text("bd-gone\t140-x\n")
    q = FakeQueue([{"id": "bd-gone", "title": "140-x"}])
    repo = RecoverRepo(root, branches=["* main"], worktrees=[])  # branch gone
    n, recoverable = reconcile(q, repo)
    assert recoverable == []
    assert n == 1 and q.requeued == ["bd-gone"]
    assert not (root / PENDING_MERGE).exists()  # stale entry cleared


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
    # claude opted in for medium/hard only, at concurrency 1 (quota preservation)
    assert snap["claude"]["max_concurrency"] == 1
    assert set(snap["claude"]["eligible"]) == {"medium", "hard"}


def _write_factory_yaml(root, text, *, name="factory.yaml"):
    h = root / "harness"
    h.mkdir(parents=True, exist_ok=True)
    (h / name).write_text(text)


def test_load_factory_config_defaults_when_absent(tmp_path):
    cfg = load_factory_config(tmp_path)  # no harness/factory.yaml
    assert cfg.workers == DEFAULT_WORKERS
    assert cfg.reserve_qwen is True
    assert cfg.order[0] == "qwen"
    assert {s.name for s in cfg.specs} == {
        "qwen", "composer_write", "claude", "gpt5_extra_write"}


def test_load_factory_config_reads_yaml(tmp_path):
    _write_factory_yaml(tmp_path, """
workers: 7
reserve_qwen: false
order: [qwen, claude]
agents:
  qwen:   { max_concurrency: 1, eligible: [easy] }
  claude: { max_concurrency: 3, eligible: [medium, hard] }
""")
    cfg = load_factory_config(tmp_path)
    assert cfg.workers == 7
    assert cfg.reserve_qwen is False
    assert cfg.order == ["qwen", "claude"]
    caps = {s.name: s.max_concurrency for s in cfg.specs}
    assert caps == {"qwen": 1, "claude": 3}
    claude = next(s for s in cfg.specs if s.name == "claude")
    assert claude.eligible == frozenset({"medium", "hard"})


def test_load_factory_config_local_override_merges(tmp_path):
    _write_factory_yaml(tmp_path, """
workers: 5
agents:
  claude: { max_concurrency: 2, eligible: [medium, hard] }
""")
    # local override bumps just claude's cap, leaving everything else intact
    _write_factory_yaml(tmp_path, """
agents:
  claude: { max_concurrency: 4 }
""", name="factory.local.yaml")
    cfg = load_factory_config(tmp_path)
    assert cfg.workers == 5
    claude = next(s for s in cfg.specs if s.name == "claude")
    assert claude.max_concurrency == 4
    assert claude.eligible == frozenset({"medium", "hard"})  # preserved


def test_load_factory_config_malformed_falls_back(tmp_path):
    _write_factory_yaml(tmp_path, "agents: { qwen: { eligible: [easy] } }")  # missing max_concurrency
    cfg = load_factory_config(tmp_path)
    assert cfg.workers == DEFAULT_WORKERS  # invalid → defaults, never crashes


def test_build_factory_honors_config_workers(tmp_path):
    _write_factory_yaml(tmp_path, "workers: 2\n")
    disp, _, _, _ = build_factory(tmp_path)  # no explicit workers → from yaml
    assert len(disp.ports_pool) == 2


def test_default_registry_health_file_roundtrip(tmp_path):
    hf = tmp_path / "agents_health.json"
    r1 = default_registry(hf)
    r1.disable("qwen", reason="quota")
    # a fresh registry (e.g. after restart / --enable path) sees it disabled
    r2 = default_registry(hf)
    assert "qwen" in r2.disabled_agents()
    r2.enable("qwen")
    assert "qwen" not in default_registry(hf).disabled_agents()
