"""Dispatcher scheduling core + outcome handling (parallel-factory Phase 2/3).

Drives tick()/reap with injected fakes — no real git, beads, or subprocesses.
"""
from __future__ import annotations

import time

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
        self.closed = []          # (ticket_id, reason) — breaker abandons
        self.difficulties = {}    # ticket_id -> difficulty — breaker escalations

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

    def close(self, ticket_id, reason="done"):
        self.closed.append((ticket_id, reason))

    def set_difficulty(self, ticket_id, difficulty):
        self.difficulties[ticket_id] = difficulty


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


def test_drain_flag_stops_new_claims_but_finishes_in_flight(tmp_path):
    """With the drain sentinel present, tick() reaps + merges but claims NO new
    work, and run()'s loop body exits once no workers remain and merges are empty."""
    q = FakeQueue({"medium": ["t1", "t2", "t3"]})
    flag = tmp_path / "drain.flag"
    pend = {"n": 0}
    d, procs, wts = _dispatcher(q, _registry())
    d.drain_flag = flag
    d.merge_pending = lambda: pend["n"]
    d.tick()                       # no flag yet → normal claims
    assert set(procs) == {"t1", "t2"}
    flag.write_text("drain")       # request drain
    procs["t1"].finish(int(PipelineResult.PASS))
    d.tick()                       # reap t1, but DON'T claim t3 (draining)
    assert "t3" not in procs       # no new claim while draining
    # finish the last in-flight worker; once workers + merge queue are empty the
    # drain-exit condition in run() is satisfiable.
    procs["t2"].finish(int(PipelineResult.PASS))
    d.tick()
    assert d._workers == {}
    assert d._drain_requested() and d.merge_pending() == 0


def test_quota_auto_recovery_reenables_on_probe_success():
    """A circuit-broken agent past its cooldown is re-probed; a recovered probe
    re-enables it with no manual --enable."""
    reg = _registry()
    reg.disable("composer", reason="quota", cooldown_s=0)   # probe_at = now → due
    assert "composer" in reg.disabled_agents()
    d, _, _ = _dispatcher(FakeQueue({}), reg)
    d.probe_fn = lambda name: True                          # quota's back
    d._recover_disabled_agents()
    assert reg.is_available("composer")


def test_quota_auto_recovery_backs_off_when_still_out():
    """A failed probe keeps the agent disabled and re-arms the cooldown (so it
    isn't probed again until the next interval — no per-tick hammering)."""
    reg = _registry()
    reg.disable("composer", reason="quota", cooldown_s=0)
    d, _, _ = _dispatcher(FakeQueue({}), reg)
    d.quota_cooldown_s = 600
    d.probe_fn = lambda name: False                         # still out
    d._recover_disabled_agents()
    assert "composer" in reg.disabled_agents()              # still disabled
    assert reg.due_for_probe() == []                        # cooldown pushed to the future


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


# --- staleness circuit-breaker (autogame-sug) -------------------------- #
def _fail(proc):
    proc.finish(int(PipelineResult.INCOMPLETE))


def test_breaker_disabled_by_default_always_requeues():
    """With breaker limits at 0 (off), behaviour is unchanged: a failure always
    requeues and never abandons."""
    q = FakeQueue({"medium": ["t1"]})
    d, procs, wts = _dispatcher(q, _registry(), ports=[PortAllocation(3000, 5173)])
    d.tick()                               # spawn t1
    _fail(procs["t1"])
    d.tick()                               # reap → requeue (no breaker)
    assert q.closed == []
    assert "t1" in q.requeued


def test_breaker_pass_clears_attempt_tracking():
    q = FakeQueue({"medium": ["t1"]})
    d, procs, wts = _dispatcher(q, _registry(), ports=[PortAllocation(3000, 5173)])
    d.tick()
    assert d._attempts["t1"] == 1 and "t1" in d._first_seen
    procs["t1"].finish(int(PipelineResult.PASS))
    d.tick()                               # reap pass → tracking cleared
    assert "t1" not in d._attempts and "t1" not in d._first_seen


def test_breaker_abandons_after_max_attempts():
    """A ticket that fails up to the attempt ceiling is closed (abandoned), not
    requeued again — bounding the churn."""
    q = FakeQueue({"medium": ["t1"]})
    d, procs, wts = _dispatcher(q, _registry(), ports=[PortAllocation(3000, 5173)])
    d.breaker_max_attempts = 2
    d.tick()                               # attempt 1
    _fail(procs["t1"]); d.tick()           # reap (1<2 → requeue) + re-spawn (attempt 2)
    assert "t1" in q.requeued and q.closed == []
    _fail(procs["t1"]); d.tick()           # reap (2>=2 → ABANDON)
    assert any(tid == "t1" for tid, _ in q.closed)
    assert q.requeued.count("t1") == 1     # not requeued a second time
    assert "t1" not in d._attempts         # tracking cleared on abandon


def test_breaker_abandons_after_max_hours():
    q = FakeQueue({"medium": ["t1"]})
    d, procs, wts = _dispatcher(q, _registry(), ports=[PortAllocation(3000, 5173)])
    d.breaker_max_hours = 1.0
    d.tick()                               # spawn t1
    d._first_seen["t1"] = time.time() - 2 * 3600   # pretend it started 2h ago
    _fail(procs["t1"]); d.tick()           # reap → 2h >= 1h → abandon
    assert any(tid == "t1" for tid, _ in q.closed)
    assert "t1" not in q.requeued


def test_breaker_escalates_to_hard_then_requeues():
    """Past the escalate threshold (but under the abandon ceiling) the ticket is
    bumped to `hard` (so qwen can't take it) and still requeued for a retry."""
    q = FakeQueue({"medium": ["t1"]})
    d, procs, wts = _dispatcher(q, _registry(), ports=[PortAllocation(3000, 5173)])
    d.breaker_escalate_attempts = 1
    d.breaker_max_attempts = 0             # never abandon in this test
    d.tick()                               # attempt 1 (difficulty medium)
    _fail(procs["t1"]); d.tick()           # reap → 1>=1 → escalate + requeue
    assert q.difficulties.get("t1") == "hard"
    assert "t1" in q.requeued
    assert q.closed == []


# --- merge-integration breaker (counts merge-queue rejections) ---------- #
def test_merge_breaker_off_by_default():
    q = FakeQueue({})
    d, _, _ = _dispatcher(q, _registry())
    for _ in range(10):
        assert d.note_merge_reject("t1") is False
    assert q.closed == [] and q.difficulties == {}


def test_merge_breaker_escalates_then_abandons():
    q = FakeQueue({})
    d, _, _ = _dispatcher(q, _registry())
    d.breaker_merge_escalate = 2
    d.breaker_merge_abandon = 4
    assert d.note_merge_reject("t1", "verify failed") is False   # 1
    assert q.difficulties == {} and q.closed == []
    assert d.note_merge_reject("t1") is False                    # 2 -> escalate
    assert q.difficulties.get("t1") == "hard"
    assert q.closed == []
    assert d.note_merge_reject("t1") is False                    # 3
    assert d.note_merge_reject("t1") is True                     # 4 -> abandon (handled)
    assert any(tid == "t1" for tid, _ in q.closed)
    assert "t1" not in d._merge_rejects                          # cleared on abandon


def test_merge_breaker_abandons_on_hours():
    q = FakeQueue({})
    d, _, _ = _dispatcher(q, _registry())
    d.breaker_max_hours = 1.0
    assert d.note_merge_reject("t1") is False                    # seeds merge_first_seen
    d._merge_first_seen["t1"] = time.time() - 2 * 3600
    assert d.note_merge_reject("t1") is True                     # 2h >= 1h -> abandon
    assert any(tid == "t1" for tid, _ in q.closed)


# --- requeue backoff + breaker persistence + watchdog ------------------- #
def test_requeue_backoff_blocks_immediate_reclaim_then_expires():
    q = FakeQueue({"medium": ["t1"]})
    d, procs, wts = _dispatcher(q, _registry())
    d.requeue_backoff_s = 60.0
    d.tick()                              # spawn t1
    assert len(wts) == 1
    procs["t1"].finish(1)                 # non-quota failure
    d.tick()                              # reap → requeue + backoff stamp; lane head cooling
    assert q.requeued == ["t1"]
    assert len(wts) == 1                  # NOT re-claimed this tick
    d.tick()
    assert len(wts) == 1                  # still cooling
    d._not_before["t1"] = time.time() - 1  # force expiry
    d.tick()
    assert len(wts) == 2                  # backoff over → re-claimed


def test_requeue_backoff_off_by_default_reclaims_next_tick():
    q = FakeQueue({"medium": ["t1"]})
    d, procs, wts = _dispatcher(q, _registry())
    d.tick()
    procs["t1"].finish(1)
    d.tick()                              # reap + immediate re-claim (old behaviour)
    assert len(wts) == 2


def test_breaker_state_persists_across_restart(tmp_path):
    sf = tmp_path / "breaker_state.json"
    q = FakeQueue({"medium": ["t1"]})
    d, procs, wts = _dispatcher(q, _registry())
    d.state_file = sf
    d.requeue_backoff_s = 60.0
    d.tick()                              # spawn → attempts=1, persisted
    procs["t1"].finish(1)
    d.tick()                              # fail → requeue + not_before persisted
    assert sf.exists()
    d2 = Dispatcher(
        queue=q, registry=_registry(), main_repo=None,
        ports_pool=[PortAllocation(3100, 5273)], lanes=["medium"],
        spawn=lambda *a: FakeProc(), state_file=sf)
    assert d2._attempts.get("t1") == 1
    assert d2._not_before.get("t1", 0) > time.time()


def test_pass_clears_persisted_backoff(tmp_path):
    sf = tmp_path / "breaker_state.json"
    q = FakeQueue({"medium": ["t1"]})
    d, procs, wts = _dispatcher(q, _registry())
    d.state_file = sf
    d.tick()
    procs["t1"].finish(int(PipelineResult.PASS))
    d.tick()                              # PASS → breaker + backoff cleared
    import json as _json
    saved = _json.loads(sf.read_text())
    assert saved["attempts"] == {} and saved["not_before"] == {}


def test_watchdog_sigterms_overdue_worker(monkeypatch):
    import os as _os
    q = FakeQueue({"medium": ["t1"]})
    d, procs, wts = _dispatcher(q, _registry())
    d.worker_max_s = 1.0
    d.tick()
    d._workers["t1"].started_at = int((time.time() - 10) * 1000)  # 10s old, 1s cap
    procs["t1"].pid = 4242
    sent = []
    monkeypatch.setattr(_os, "getpgid", lambda pid: pid)
    monkeypatch.setattr(_os, "killpg", lambda pgid, sig: sent.append((pgid, sig)))
    d.tick()
    assert sent and sent[0][0] == 4242
    assert "t1" in d._kill_sent
    d.tick()                              # within the 60s TERM grace — no second signal
    assert len(sent) == 1


def test_watchdog_off_by_default_leaves_worker_alone(monkeypatch):
    import os as _os
    q = FakeQueue({"medium": ["t1"]})
    d, procs, wts = _dispatcher(q, _registry())
    d.tick()
    d._workers["t1"].started_at = int((time.time() - 99999) * 1000)
    procs["t1"].pid = 4242
    sent = []
    monkeypatch.setattr(_os, "killpg", lambda pgid, sig: sent.append(sig))
    d.tick()
    assert sent == []


# --- ticket_dir_name: prose bead titles → valid branch/dir names -------- #
def test_ticket_dir_name_passes_clean_legacy_slugs_through():
    from harness.dispatch.dispatcher import ticket_dir_name
    assert ticket_dir_name("autogame-x1", "373-playthrough-validate-fire-level") \
        == "373-playthrough-validate-fire-level"


def test_ticket_dir_name_slugifies_prose_titles_with_id_suffix():
    import re as _re
    from harness.dispatch.dispatcher import ticket_dir_name
    name = ticket_dir_name(
        "autogame-oumk",
        "Server: bulkhead_mauler minions attack every tick; mauler broadcasts CARD_USED 20x/sec")
    assert _re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]*", name), name
    assert name.endswith("-oumk")          # bead id keeps collisions impossible
    assert ".." not in name and len(name) <= 80


def test_ticket_dir_name_empty_title_falls_back_to_id():
    from harness.dispatch.dispatcher import ticket_dir_name
    assert ticket_dir_name("autogame-zz9", "") == "zz9"


def test_spawned_worker_uses_sanitized_name():
    q = FakeQueue({"medium": ["t1"]})
    q._ready["medium"] = ["t1"]
    # claim returns a prose title — the worktree/branch name must be sanitized
    orig = q.claim_ready
    def claim(**kw):
        issue = orig(**kw)
        if issue:
            issue["title"] = "Fix: a thing / another (badly: named)"
        return issue
    q.claim_ready = claim
    d, procs, wts = _dispatcher(q, _registry())
    d.tick()
    assert wts and " " not in wts[0].name and ":" not in wts[0].name and "/" not in wts[0].name


def test_worktree_create_failure_backs_off():
    q = FakeQueue({"medium": ["t1"]})
    d, procs, wts = _dispatcher(q, _registry())
    d.requeue_backoff_s = 60.0
    d.worktree_factory = lambda name, ports: (_ for _ in ()).throw(RuntimeError("boom"))
    d.tick()
    assert q.requeued == ["t1"]
    assert d._not_before.get("t1", 0) > time.time()


def test_quota_scan_matches_worker_agent_field(tmp_path):
    import json as _json
    from harness.dispatch.dispatcher import _agent_hit_quota
    row = {"label": "claude", "model": "claude", "worker_agent": "claude_fable",
           "reason": "quota_or_rate_limit", "ended_ms": 2_000}
    (tmp_path / "agent-usage.ndjson").write_text(_json.dumps(row) + "\n")
    assert _agent_hit_quota(tmp_path, "claude_fable", since_ms=1_000) is True
    assert _agent_hit_quota(tmp_path, "composer_write", since_ms=1_000) is False
