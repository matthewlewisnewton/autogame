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
    # order [composer, qwen]: with composer ineligible for easy and qwen
    # ineligible for hard, eligibility routes easy→qwen, medium→composer,
    # hard→composer — the deterministic setup these dispatcher tests expect.
    return AgentRegistry(
        [AgentSpec("qwen", 1, frozenset({"easy", "medium"})),
         AgentSpec("composer", 3, frozenset({"medium", "hard"}))],
        ["composer", "qwen"],
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


def test_backpressure_pauses_new_claims_but_still_drains():
    """When the merge queue is backed up, tick() skips claiming NEW work but still
    reaps + drains; once backpressure clears, claims resume."""
    q = FakeQueue({"medium": ["t1", "t2", "t3"]})
    drains = {"n": 0}
    gate = {"on": True}
    d, procs, wts = _dispatcher(q, _registry())
    d.merge_drain = lambda: drains.__setitem__("n", drains["n"] + 1)
    d.backpressure = lambda: gate["on"]
    d.tick()
    assert procs == {}             # backpressure ON → nothing claimed/spawned
    assert drains["n"] == 1        # but the merge queue still drained
    gate["on"] = False
    d.tick()
    assert set(procs) == {"t1", "t2"}  # released → claims resume
    assert drains["n"] == 2


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


def test_spawn_failure_requeues_and_frees_slot():
    """If launching the worker raises, the just-created worktree, the port pair,
    and the agent slot must all be reclaimed and the ticket requeued (else they
    leak and the bead is stuck in_progress)."""
    q = FakeQueue({"medium": ["t1"]})
    reg = _registry()
    wts = []

    def boom_spawn(tid, agent, wt, ports_):
        raise RuntimeError("Popen failed")

    def wt_factory(name, ports_):
        wt = FakeWorktree(name, ports_)
        wts.append(wt)
        return wt

    d = Dispatcher(
        queue=q, registry=reg, main_repo=None,
        ports_pool=[PortAllocation(3000, 5173)], lanes=["medium"],
        spawn=boom_spawn, worktree_factory=wt_factory,
        quota_classifier=lambda agent: False, on_pass=lambda w: None,
    )
    d.tick()
    assert d._workers == {}                 # nothing left running
    assert len(d._free_ports) == 1          # port pair reclaimed
    assert wts[0].removed                   # worktree torn down
    assert "t1" in q.requeued               # ticket back in the pool
    assert reg.snapshot()["composer"]["in_flight"] == 0  # agent slot released


class LeakyWorktree(FakeWorktree):
    def remove_worktree(self, **kw):
        self.removed = True
        return False  # simulate a worktree that couldn't be removed (still registered)


def test_leaked_worktree_quarantines_port():
    """When teardown reports the worktree leaked, its port pair must NOT be
    recycled — reusing it would collide with the still-registered path."""
    q = FakeQueue({"medium": ["t1"]})
    reg = _registry()

    def spawn(tid, agent, wt, ports_):
        p = FakeProc()
        spawn.proc = p
        return p

    d = Dispatcher(
        queue=q, registry=reg, main_repo=None,
        ports_pool=[PortAllocation(3000, 5173)], lanes=["medium"],
        spawn=spawn,
        worktree_factory=lambda name, ports_: LeakyWorktree(name, ports_),
        quota_classifier=lambda agent: False, on_pass=lambda w: None,
    )
    d.tick()
    spawn.proc.finish(int(PipelineResult.INCOMPLETE))
    d.tick()                                # reap: failure, remove_worktree -> False
    assert d._free_ports == []              # port quarantined, not returned
    assert reg.snapshot()["composer"]["in_flight"] == 0  # but the agent slot IS freed


def _reservation_dispatcher(q, *, reserve):
    procs = {}
    wts = []

    def spawn(tid, agent, wt, ports_):
        p = FakeProc()
        procs[tid] = p
        return p

    return Dispatcher(
        queue=q, registry=_registry(), main_repo=None,
        ports_pool=[PortAllocation(3000, 5173), PortAllocation(3001, 5174)],
        lanes=["hard", "medium", "easy"],
        spawn=spawn,
        worktree_factory=lambda name, ports_: (wts.append(name) or FakeWorktree(name, ports_)),
        quota_classifier=lambda agent: False, on_pass=lambda w: None,
        reserve_qwen=reserve,
    )


def test_reserve_qwen_prefers_easy_under_hard_load():
    # 2 ports, more hard work than ports — without a reservation hard would take
    # every slot and qwen would never run.
    q = FakeQueue({"hard": ["h1", "h2"], "easy": ["e1"]})
    d = _reservation_dispatcher(q, reserve=True)
    d.tick()
    agents = {(w.agent, w.difficulty) for w in d._workers.values()}
    assert ("qwen", "easy") in agents               # qwen reserved an easy slot
    assert any(a == "composer" for a, _ in agents)  # remaining slot still did hard


def test_reserve_qwen_falls_back_to_medium_when_no_easy():
    # no easy work, but medium is ready — qwen should take a medium ticket to
    # stay busy rather than sit idle while hard fills the rest.
    q = FakeQueue({"hard": ["h1", "h2"], "medium": ["m1"]})
    d = _reservation_dispatcher(q, reserve=True)
    d.tick()
    agents = {(w.agent, w.difficulty) for w in d._workers.values()}
    assert ("qwen", "medium") in agents             # qwen kept busy on medium


def test_without_reservation_hard_load_starves_qwen():
    q = FakeQueue({"hard": ["h1", "h2"], "easy": ["e1"]})
    d = _reservation_dispatcher(q, reserve=False)
    d.tick()
    assert "qwen" not in {w.agent for w in d._workers.values()}  # both ports → hard


def test_reserve_qwen_noop_when_no_easy_or_medium():
    q = FakeQueue({"hard": ["h1", "h2"]})
    d = _reservation_dispatcher(q, reserve=True)
    d.tick()
    # nothing qwen-eligible ready → no qwen, and the registry slot isn't leaked
    assert "qwen" not in {w.agent for w in d._workers.values()}
    assert d.registry.snapshot()["qwen"]["in_flight"] == 0


def test_agent_hit_quota_respects_since_ms(tmp_path):
    """A quota row that predates the worker's start must be ignored; one within
    its run window trips the breaker."""
    import json
    from harness.dispatch.dispatcher import _agent_hit_quota

    path = tmp_path / "agent-usage.ndjson"
    stale = {"label": "qwen", "model": "qwen", "reason": "quota_or_rate_limit",
             "ended_ms": 1000}
    recent_ok = {"label": "qwen", "model": "qwen", "reason": "ok", "ended_ms": 5000}
    path.write_text(json.dumps(stale) + "\n" + json.dumps(recent_ok) + "\n")
    # worker started at 4000ms — the stale quota row (1000ms) is out of window
    assert _agent_hit_quota(tmp_path, "qwen", since_ms=4000) is False
    # a quota failure inside the window is caught
    with path.open("a") as f:
        f.write(json.dumps({"label": "qwen", "model": "qwen",
                            "reason": "quota_or_rate_limit", "ended_ms": 6000}) + "\n")
    assert _agent_hit_quota(tmp_path, "qwen", since_ms=4000) is True
    # with no window bound, the stale row alone still trips it (back-compat)
    assert _agent_hit_quota(tmp_path, "qwen") is True
