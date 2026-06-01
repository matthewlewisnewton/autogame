"""Dispatcher scheduling core + outcome handling (parallel-factory Phase 2/3).

Drives tick()/reap with injected fakes — no real git, beads, or subprocesses.
"""
from __future__ import annotations

from harness.dispatch.dispatcher import Dispatcher, WorkerHandle
from harness.dispatch.registry import AgentRegistry, AgentSpec
from harness.pipelines.result import PipelineResult
from harness.workspace.ports import PortAllocation


# --- fakes ------------------------------------------------------------- #
class FakeQueue:
    def __init__(self, ready_by_diff):
        self._ready = {d: list(ids) for d, ids in ready_by_diff.items()}
        self.requeued = []
        self.assigned = {}

    def ready(self, *, difficulty=None, limit=100):
        return [{"id": i} for i in self._ready.get(difficulty, [])][:limit]

    def claim_ready(self, *, difficulty=None, assignee=None):
        q = self._ready.get(difficulty, [])
        if not q:
            return None
        tid = q.pop(0)
        self.assigned[tid] = assignee
        return {"id": tid, "title": tid, "assignee": assignee}

    def requeue(self, ticket_id, *, note=None):
        self.requeued.append(ticket_id)
        # back to the front of its (assumed medium) lane for re-pickup
        self._ready.setdefault("medium", []).insert(0, ticket_id)


class FakeProc:
    def __init__(self):
        self._rc = None

    def finish(self, rc):
        self._rc = rc

    def poll(self):
        return self._rc


class FakeWorktree:
    def __init__(self, name, ports):
        self.name = name
        self.ports = ports
        self.removed = False

    def remove_worktree(self, **kw):
        self.removed = True
        return True


def _registry():
    return AgentRegistry(
        [AgentSpec("qwen", 1, frozenset({"easy", "medium"})),
         AgentSpec("composer", 3, frozenset({"medium", "hard"}))],
        {"easy": ["qwen"], "medium": ["composer", "qwen"], "hard": ["composer"]},
    )


def _dispatcher(queue, registry, *, ports=None, quota=False, passed_collector=None):
    procs = {}
    worktrees = []  # all created, in order (a ticket can be re-dispatched)

    def spawn(tid, agent, wt, ports_):
        p = FakeProc()
        procs[tid] = p
        return p

    def wt_factory(name, ports_):
        wt = FakeWorktree(name, ports_)
        worktrees.append(wt)
        return wt

    d = Dispatcher(
        queue=queue, registry=registry, main_repo=None,
        ports_pool=ports or [PortAllocation(3000, 5173), PortAllocation(3001, 5174)],
        lanes=["medium"],
        spawn=spawn,
        worktree_factory=wt_factory,
        quota_classifier=lambda agent: quota,
        on_pass=(passed_collector.append if passed_collector is not None else (lambda w: None)),
    )
    return d, procs, worktrees


def test_tick_claims_and_spawns_up_to_capacity():
    q = FakeQueue({"medium": ["t1", "t2", "t3"]})
    d, procs, wts = _dispatcher(q, _registry())
    d.tick()
    # 2 ports available → exactly 2 workers spawned; t3 waits
    assert set(procs) == {"t1", "t2"}
    assert q.assigned == {"t1": "composer", "t2": "composer"}


def test_pass_frees_slot_and_calls_on_pass():
    q = FakeQueue({"medium": ["t1", "t2", "t3"]})
    passed = []
    d, procs, wts = _dispatcher(q, _registry(), passed_collector=passed)
    d.tick()                       # spawn t1, t2 (2 ports)
    procs["t1"].finish(int(PipelineResult.PASS))
    d.tick()                       # reap t1 (pass) → free a port → spawn t3
    assert [w.ticket_id for w in passed] == ["t1"]
    assert wts[0].name == "t1" and not wts[0].removed  # merge queue owns teardown on pass
    assert "t3" in procs           # freed slot reused


def test_quota_failure_disables_agent_and_requeues():
    q = FakeQueue({"medium": ["t1"]})
    d, procs, wts = _dispatcher(q, _registry(), ports=[PortAllocation(3000, 5173)], quota=True)
    d.tick()                       # spawn t1 on composer
    procs["t1"].finish(int(PipelineResult.ESCALATE))
    d.tick()                       # reap t1 (failure + quota) → disable composer, requeue, teardown
    assert "composer" in d.registry.disabled_agents()
    assert "t1" in q.requeued
    assert wts[0].name == "t1" and wts[0].removed      # original failed worktree torn down
    # circuit breaker working: t1 was immediately re-dispatched to qwen (composer disabled)
    assert q.assigned["t1"] == "qwen"


def test_nonquota_failure_requeues_without_disabling():
    q = FakeQueue({"medium": ["t1"]})
    d, procs, wts = _dispatcher(q, _registry(), ports=[PortAllocation(3000, 5173)], quota=False)
    d.tick()
    procs["t1"].finish(int(PipelineResult.INCOMPLETE))
    d.tick()
    assert d.registry.disabled_agents() == []
    assert "t1" in q.requeued
    assert wts[0].removed
