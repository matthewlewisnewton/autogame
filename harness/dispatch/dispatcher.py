"""Dispatcher — the parallel factory's scheduler.

Ties the pieces together: pull ready work per difficulty lane from beads
(`BeadsQueue`), pick an eligible/under-cap/healthy agent (`AgentRegistry`),
atomically claim the ticket, and spawn the existing `ticket()` pipeline as a
WORKER SUBPROCESS (`harness worker`) in an isolated `WorktreeWorkspace` with
allocated ports. On worker completion: PASS → hand the branch to the merge
queue; a quota/unavailable failure → disable the agent (circuit breaker) and
requeue the ticket; any other failure → requeue.

The scheduling core (`tick`) and outcome handling are pure given injected I/O
(spawn fn, quota classifier, on-pass callback), so they unit-test with fakes.
`run()` is the thin polling loop around them. The dispatcher is the SOLE beads
writer and the SOLE creator of worktrees, so claims and worktree lifecycle are
single-threaded — no cross-process lock needed there.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Optional

from harness.beads import BeadsQueue
from harness.dispatch.registry import AgentRegistry
from harness.pipelines.result import PipelineResult
from harness.telemetry.logging import log
from harness.telemetry.progress import emit_progress_event, progress_dir
from harness.workspace.ports import PortAllocation
from harness.workspace.repo import Repo, WorktreeWorkspace


@dataclass
class WorkerHandle:
    ticket_id: str        # beads bead id — for queue close/requeue
    ticket_name: str      # tickets/<name> dir — for the worktree + `harness worker <name>`
    agent: str
    difficulty: str
    worktree: WorktreeWorkspace
    proc: object  # has .poll() -> Optional[int]
    started_at: int = 0  # epoch ms when spawned — lower-bounds the quota scan

    def poll(self) -> Optional[int]:
        return self.proc.poll()


# spawn(ticket_id, agent, worktree, ports) -> a process handle with .poll()
SpawnFn = Callable[[str, str, WorktreeWorkspace, PortAllocation], object]
# quota_classifier(agent) -> True if the agent's recent calls show quota/unavailable
QuotaFn = Callable[[str], bool]
# on_pass(handle) -> enqueue the worker's branch for merge (merge queue owns teardown)
OnPassFn = Callable[[WorkerHandle], None]


def subprocess_spawn(ticket_name: str, agent: str, worktree: WorktreeWorkspace,
                     ports: PortAllocation) -> subprocess.Popen:
    """Launch `harness worker <ticket_name>` in the worktree with ports + shared
    telemetry."""
    env = {
        **os.environ,
        "HARNESS_GAME_PORT": str(ports.game_server),
        "HARNESS_VITE_PORT": str(ports.vite),
        # Pin telemetry to the MAIN checkout's progress dir so the live view is unified.
        "HARNESS_PROGRESS_DIR": str(progress_dir()),
    }
    return subprocess.Popen(
        [sys.executable, "-m", "harness", "worker", ticket_name, "--agent", agent],
        cwd=str(worktree.root), env=env, start_new_session=True,
    )


@dataclass
class Dispatcher:
    queue: BeadsQueue
    registry: AgentRegistry
    main_repo: Repo
    ports_pool: list[PortAllocation]
    lanes: list[str] = field(default_factory=lambda: ["hard", "medium", "easy"])
    spawn: SpawnFn = subprocess_spawn
    quota_classifier: Optional[QuotaFn] = None
    on_pass: Optional[OnPassFn] = None
    merge_drain: Optional[Callable[[], None]] = None  # drain one merge per tick (set by launcher)
    # Backpressure: returns True when too many PASSED branches are waiting to
    # merge — the dispatcher then skips claiming NEW work this tick (reap +
    # merge_drain still run) so reviewed tickets drain instead of piling up and
    # going stale. None = unbounded (no backpressure).
    backpressure: Optional[Callable[[], bool]] = None
    worktree_factory: Optional[Callable[[str, PortAllocation], WorktreeWorkspace]] = None
    tick_seconds: float = 5.0
    # Keep the local ollama box (GPU) hot: reserve a slot for qwen every tick
    # (before the other lanes can claim every port) on an easy ticket — or a
    # medium one when no easy work remains — so qwen is never idle while there's
    # easy/medium work to do.
    reserve_qwen: bool = False
    # Graceful drain: when this sentinel file exists, the dispatcher stops
    # claiming NEW work (reap + merge_drain keep running) and run() exits once
    # every in-flight worker has finished and the merge queue is empty — a clean
    # "finish what's started, then stop" so a restart loses no in-flight work.
    drain_flag: Optional[Path] = None
    merge_pending: Optional[Callable[[], int]] = None
    # Auto-triage safety net: periodically label OPEN beads that have no
    # difficulty lane so they stop stranding (no lane query matches them). Runs
    # INSIDE the dispatcher (sole beads writer) so it never contends on the
    # single-writer Dolt lock. `triage_every` ticks between passes (0 = off).
    triage: Optional[Callable[[], None]] = None
    triage_every: int = 0
    # Quota auto-recovery: when a remote agent is circuit-broken on quota it's
    # disabled with a cooldown; once that elapses, probe_fn(name) re-checks its
    # quota (cheap "reply OK" in an isolated dir) and the agent is re-enabled the
    # moment it recovers — no manual `--enable`. None = no auto-recovery (a
    # quota-disabled agent stays down until a human re-enables, the old behaviour).
    probe_fn: Optional[Callable[[str], Optional[bool]]] = None
    quota_cooldown_s: float = 600.0
    # Staleness circuit-breaker (autogame-sug). A ticket that keeps failing keeps
    # getting requeued + re-spawned (177 churned ~12h, 171 looped ~8h). These bound
    # the loss across that requeue loop, keyed per bead across attempts:
    #   - escalate: after this many failed attempts, BUMP the ticket to `hard` so
    #     the cheap/slow agent that churned (qwen, easy+medium only) is no longer
    #     eligible and a stronger agent (composer/claude/gpt5) takes the retry.
    #   - abandon: after this many attempts OR this many wall-clock hours, stop
    #     retrying entirely — close the bead with an "abandoned" reason + event so
    #     it leaves the ready pool instead of churning forever.
    # 0 / 0.0 = that limit is OFF (default off so existing behaviour/tests are
    # unchanged; the launcher wires real values).
    breaker_escalate_attempts: int = 0
    breaker_max_attempts: int = 0
    breaker_max_hours: float = 0.0

    _workers: dict[str, WorkerHandle] = field(default_factory=dict, init=False)
    _free_ports: list[PortAllocation] = field(default_factory=list, init=False)
    _backpressure_active: bool = field(default=False, init=False)
    _last_status_digest: str = field(default="", init=False)
    _draining_logged: bool = field(default=False, init=False)
    _tick_count: int = field(default=0, init=False)
    # Staleness breaker bookkeeping, keyed by bead id and persisted across the
    # requeue/respawn loop (cleared on PASS or abandon).
    _attempts: dict[str, int] = field(default_factory=dict, init=False)
    _first_seen: dict[str, float] = field(default_factory=dict, init=False)

    def __post_init__(self):
        self._free_ports = list(self.ports_pool)
        # NOTE: quota_classifier intentionally left None by default — the
        # built-in path (_hit_quota) is time-window-aware and needs the worker's
        # start timestamp, which a bare (agent)->bool classifier can't see.
        if self.worktree_factory is None:
            self.worktree_factory = lambda name, ports: WorktreeWorkspace.create(
                self.main_repo, name=name, ports=ports)

    # --- one scheduling pass (pure given injected I/O) ------------------ #
    def tick(self) -> None:
        """One scheduling pass, then publish factory status for the live view.
        The status emit is in a finally so it runs even on the backpressure
        early-return — and so a stale panel signals a tick stuck mid-merge."""
        try:
            self._tick_inner()
        finally:
            self._emit_status()

    def _tick_inner(self) -> None:
        self._reap()
        if self.merge_drain is not None:
            try:
                self.merge_drain()  # integrate one passed branch into main this tick
            except Exception as e:
                log(f"[dispatch] merge_drain raised (continuing tick): {e!r}")
        # Auto-triage safety net: every `triage_every` ticks, label OPEN beads
        # with no difficulty lane so they stop stranding. Skip while draining
        # (no new beads should be touched). Best-effort — triage must NEVER break
        # a tick, so log + continue on any error.
        self._tick_count += 1
        if (self.triage is not None and self.triage_every > 0
                and self._tick_count % self.triage_every == 0
                and not self._drain_requested()):
            try:
                self.triage()
            except Exception as e:
                log(f"[dispatch] triage raised (continuing tick): {e!r}")
        # Quota auto-recovery: re-probe any circuit-broken agent whose cooldown
        # has elapsed and re-enable it the moment its quota is back (skip while
        # draining — we're winding down, not bringing agents back).
        if self.probe_fn is not None and not self._drain_requested():
            self._recover_disabled_agents()
        # Backpressure: if the merge queue is backed up, don't take on new work
        # this tick — let it drain first (reap + merge_drain above already ran).
        if self.backpressure is not None:
            try:
                if self.backpressure():
                    if not self._backpressure_active:
                        self._backpressure_active = True
                        log("[dispatch] merge backpressure ON — pausing new claims until the merge queue drains")
                    return
                if self._backpressure_active:
                    self._backpressure_active = False
                    log("[dispatch] merge backpressure OFF — resuming claims")
            except Exception as e:
                log(f"[dispatch] backpressure check raised (ignoring): {e!r}")
        if self._drain_requested():
            if not self._draining_logged:
                self._draining_logged = True
                log("[dispatch] DRAIN requested — not claiming new work; "
                    "finishing in-flight workers + merges, then exiting")
            return
        if self.reserve_qwen:
            self._reserve_qwen()
        for difficulty in self.lanes:
            while self._free_ports:
                agent = self.registry.select_and_acquire(difficulty)
                if agent is None:
                    break  # no eligible/free/healthy agent for this lane right now
                issue = self.queue.claim_ready(difficulty=difficulty, assignee=agent)
                if issue is None:
                    self.registry.release(agent)  # nothing ready in this lane; give the slot back
                    break
                if not self._spawn_worker(issue["id"], issue.get("title") or issue["id"],
                                          agent, difficulty):
                    # Spawn/worktree-create failed and the ticket was requeued.
                    # Stop claiming in this lane this tick — otherwise we'd
                    # immediately re-claim the same requeued ticket and hot-loop
                    # on a persistent infra failure. It retries next tick.
                    break

    def _drain_requested(self) -> bool:
        return self.drain_flag is not None and self.drain_flag.exists()

    def _recover_disabled_agents(self) -> None:
        """For each circuit-broken agent past its cooldown, probe its quota; on
        recovery re-enable it, else re-arm the cooldown so we back off instead of
        probing every tick. The probe runs an isolated CLI call (may take a few
        seconds) — only `due_for_probe()` agents are probed, so this is rare."""
        try:
            due = self.registry.due_for_probe()
        except Exception as e:
            log(f"[dispatch] due_for_probe raised (ignoring): {e!r}")
            return
        for name in due:
            try:
                result = self.probe_fn(name)
            except Exception as e:
                log(f"[dispatch] quota probe of {name} raised ({e!r}) — backing off")
                result = False
            if result is True:
                self.registry.enable(name)
                log(f"[dispatch] {name} quota recovered — re-enabled")
                emit_progress_event("agent_reenabled", {"agent": name})
            else:
                # Still out (False) or undetermined (None): push the next probe out
                # so we don't hammer it, keeping it disabled meanwhile.
                self.registry.disable(name, reason="quota (still out)",
                                      cooldown_s=self.quota_cooldown_s)

    def idle(self) -> bool:
        """True when nothing is running and no lane has ready work."""
        if self._workers:
            return False
        return all(not self.queue.ready(difficulty=d, limit=1) for d in self.lanes)

    def _emit_status(self) -> None:
        """Publish a `factory_status` event (agents running/idle + flock holders)
        for the live view. Emits only when the state CHANGES — the dispatcher
        ticks every few seconds and an unchanged panel doesn't need a new event.
        Best-effort: never let telemetry break a scheduling tick."""
        try:
            running_by_agent: dict[str, list[str]] = {}
            for w in self._workers.values():
                running_by_agent.setdefault(w.agent, []).append(w.ticket_name)
            snap = self.registry.snapshot()
            agents = [
                {"name": name, "in_flight": s["in_flight"],
                 "cap": s["max_concurrency"], "health": s["health"],
                 "eligible": s["eligible"],
                 "running": sorted(running_by_agent.get(name, []))}
                for name, s in sorted(snap.items())
            ]
            try:
                from harness.concurrency.resource_lock import lock_status
                locks = lock_status()
            except Exception:
                locks = []
            payload = {
                "agents": agents,
                "locks": locks,
                "free_ports": len(self._free_ports),
                "backpressure": self._backpressure_active,
            }
            digest = json.dumps(payload, sort_keys=True)
            if digest == self._last_status_digest:
                return
            self._last_status_digest = digest
            emit_progress_event("factory_status", payload)
        except Exception as e:
            log(f"[dispatch] status emit failed (ignoring): {e!r}")

    # --- internals ------------------------------------------------------ #
    def _reserve_qwen(self) -> None:
        """Keep qwen (the local GPU box) busy so we always get value from it:
        before the other lanes consume every port, claim a ticket for qwen —
        an easy one if any are ready (preferred: keeps the model resident), else
        a medium one. No-op when qwen is already mid-flight (cap 1, so
        try_acquire fails) or no easy/medium work is ready."""
        if not self._free_ports:
            return
        for lane in ("easy", "medium"):
            if not self.queue.ready(difficulty=lane, limit=1):
                continue
            if not self.registry.try_acquire("qwen", lane):
                return  # qwen busy/unavailable — nothing to reserve this tick
            issue = self.queue.claim_ready(difficulty=lane, assignee="qwen")
            if issue is None:
                self.registry.release("qwen")
                continue  # lost the race for this lane; try the next
            self._spawn_worker(issue["id"], issue.get("title") or issue["id"],
                               "qwen", lane)
            return

    def _spawn_worker(self, bead_id: str, ticket_name: str, agent: str,
                      difficulty: str) -> bool:
        """Create a worktree + launch the worker. Returns True on success. On
        failure the ticket is requeued and the slot/agent reclaimed; returns
        False so tick() backs off this lane (no hot-retry on persistent infra
        failure)."""
        ports = self._free_ports.pop()
        try:
            wt = self.worktree_factory(ticket_name, ports)
        except Exception as e:  # creation failed → undo the claim + slot reservation
            log(f"[dispatch] worktree create failed for {ticket_name}: {e!r} — requeuing")
            self._free_ports.append(ports)
            self.registry.release(agent)
            self.queue.requeue(bead_id, note=f"worktree create failed: {e!r}")
            return False
        # Best-effort: materialize a ticket.md from the bead when one isn't
        # already committed on disk (an on-disk hand-authored spec always wins).
        # A render failure must never block the spawn.
        try:
            bead = self.queue.show(bead_id)
            if bead:
                from harness.dispatch.ticket_render import render_ticket_md
                render_ticket_md(bead, Path(wt.root) / "tickets" / ticket_name / "ticket.md")
        except Exception as e:
            log(f"[dispatch] ticket.md render skipped for {ticket_name}: {e!r}")
        try:
            proc = self.spawn(ticket_name, agent, wt, ports)
        except Exception as e:  # Popen/launch failed → tear down the worktree too
            log(f"[dispatch] spawn failed for {ticket_name}: {e!r} — requeuing")
            wt.remove_worktree()
            self._free_ports.append(ports)
            self.registry.release(agent)
            self.queue.requeue(bead_id, note=f"spawn failed: {e!r}")
            return False
        self._workers[bead_id] = WorkerHandle(
            bead_id, ticket_name, agent, difficulty, wt, proc,
            started_at=int(time.time() * 1000))
        # Staleness-breaker bookkeeping: count this attempt and stamp first-seen
        # (the wall-clock the ticket FIRST started churning, kept across requeues).
        self._attempts[bead_id] = self._attempts.get(bead_id, 0) + 1
        self._first_seen.setdefault(bead_id, time.time())
        emit_progress_event("dispatch_spawn", {
            "ticket": ticket_name, "agent": agent, "difficulty": difficulty,
            "game_port": ports.game_server, "vite_port": ports.vite,
        })
        return True

    def _reap(self) -> None:
        for tid, w in list(self._workers.items()):
            rc = w.poll()
            if rc is None:
                continue
            teardown_ok = self._handle_outcome(w, rc)
            del self._workers[tid]
            self.registry.release(w.agent)
            if teardown_ok:
                self._free_ports.append(w.worktree.ports)
            else:
                # Worktree leaked (still registered) — reusing its port pair would
                # collide with the stale path on the next worktree add. Quarantine
                # the slot: drop the port pair until a human prunes + restarts.
                emit_progress_event("slot_quarantined", {
                    "ticket": w.ticket_name,
                    "game_port": w.worktree.ports.game_server,
                    "vite_port": w.worktree.ports.vite,
                })

    def _hit_quota(self, w: WorkerHandle) -> bool:
        """True if this worker's agent hit a quota/unavailable failure. An
        injected classifier (tests) takes precedence; otherwise scan the shared
        usage log bounded to THIS worker's run window so a sibling worker's (or
        an old) quota row can't falsely trip the breaker."""
        if self.quota_classifier is not None:
            return self.quota_classifier(w.agent)
        return _agent_hit_quota(progress_dir(), w.agent, since_ms=w.started_at)

    def _handle_outcome(self, w: WorkerHandle, rc: int) -> bool:
        """Return True if the worker's port pair is safe to recycle. PASS hands
        the worktree to the merge queue (owns teardown) but the process has
        exited so the port is free → True. On failure, teardown happens here and
        the return reflects whether the worktree actually went away."""
        if rc == int(PipelineResult.PASS):
            emit_progress_event("dispatch_pass", {"ticket": w.ticket_name, "agent": w.agent})
            self._clear_breaker(w.ticket_id)  # done — stop tracking churn for it
            if self.on_pass is not None:
                self.on_pass(w)   # merge queue takes the branch + owns teardown
            else:
                w.worktree.remove_worktree()  # no merge queue wired → don't leak
            return True
        # Failure. If the agent itself hit quota/unavailability, trip the breaker.
        if self._hit_quota(w):
            cd = self.quota_cooldown_s if self.probe_fn is not None else None
            log(f"[dispatch] {w.agent} hit quota/unavailable — disabling"
                + (f" (auto-reprobe in {int(cd)}s)" if cd else " until re-enabled"))
            self.registry.disable(w.agent, reason="quota or unavailable", cooldown_s=cd)
            emit_progress_event("agent_disabled", {"agent": w.agent, "reason": "quota"})
        # Staleness breaker: abandon a ticket that has churned too long/too many
        # times; otherwise requeue (after a possible difficulty bump to a faster
        # agent). A quota disable above still requeues — quota is the agent's fault,
        # not the ticket's, so it doesn't count toward abandonment.
        if not self._apply_breaker(w):
            self.queue.requeue(w.ticket_id, note=f"{w.agent} failed (rc={rc})")
            emit_progress_event("dispatch_requeue",
                                {"ticket": w.ticket_name, "agent": w.agent, "rc": rc})
        return w.worktree.remove_worktree()

    def _clear_breaker(self, tid: str) -> None:
        self._attempts.pop(tid, None)
        self._first_seen.pop(tid, None)

    def _apply_breaker(self, w: WorkerHandle) -> bool:
        """Staleness circuit-breaker (autogame-sug). Given a FAILED ticket, decide
        based on how many attempts it's had and how long it's been churning:
          - ABANDON (return True): past the attempt/hour ceiling — close the bead so
            it leaves the ready pool instead of looping forever; caller must NOT
            requeue.
          - ESCALATE then requeue (return False): past the softer escalate
            threshold — bump it to `hard` so qwen (easy/medium only) stops getting
            it and a stronger agent retries.
          - else requeue as usual (return False).
        Every beads op is best-effort: a breaker failure must never crash a tick —
        on error we fall back to a plain requeue (the pre-breaker behaviour)."""
        tid = w.ticket_id
        attempts = self._attempts.get(tid, 0)
        elapsed_h = (time.time() - self._first_seen.get(tid, time.time())) / 3600.0

        hit_attempts = self.breaker_max_attempts and attempts >= self.breaker_max_attempts
        hit_hours = self.breaker_max_hours and elapsed_h >= self.breaker_max_hours
        if hit_attempts or hit_hours:
            reason = (f"abandoned by staleness breaker: {attempts} attempts, "
                      f"{elapsed_h:.1f}h churning (last agent {w.agent})")
            try:
                self.queue.close(tid, reason=reason)
            except Exception as e:
                log(f"[dispatch] breaker close failed for {w.ticket_name}: {e!r} "
                    f"— falling back to requeue")
                return False
            log(f"[dispatch] BREAKER abandoned {w.ticket_name} — {reason}")
            emit_progress_event("ticket_abandoned", {
                "ticket": w.ticket_name, "agent": w.agent,
                "attempts": attempts, "hours": round(elapsed_h, 1),
            })
            self._clear_breaker(tid)
            return True

        if (self.breaker_escalate_attempts
                and attempts >= self.breaker_escalate_attempts
                and w.difficulty != "hard"):
            try:
                self.queue.set_difficulty(tid, "hard")
                log(f"[dispatch] BREAKER escalating {w.ticket_name} "
                    f"({w.difficulty} -> hard) after {attempts} attempts on {w.agent}")
                emit_progress_event("ticket_escalated", {
                    "ticket": w.ticket_name, "from": w.difficulty, "to": "hard",
                    "attempts": attempts, "agent": w.agent,
                })
            except Exception as e:
                log(f"[dispatch] breaker escalate failed for {w.ticket_name}: {e!r}")
        return False

    # --- run loop ------------------------------------------------------- #
    def run(self, *, max_idle_ticks: int = 0) -> None:
        """Poll-schedule-reap until idle (if max_idle_ticks>0) or forever."""
        idle_ticks = 0
        while True:
            self.tick()
            if self._drain_requested():
                pend = self.merge_pending() if self.merge_pending else 0
                if not self._workers and pend == 0:
                    log("[dispatch] drain complete — no in-flight workers and "
                        "merge queue empty; exiting cleanly for restart")
                    return
            if self.idle():
                idle_ticks += 1
                if max_idle_ticks and idle_ticks >= max_idle_ticks:
                    log("[dispatch] backlog drained and no workers running — stopping")
                    return
            else:
                idle_ticks = 0
            time.sleep(self.tick_seconds)


def _agent_hit_quota(progress: Path, agent: str, *, lookback: int = 40,
                     since_ms: Optional[int] = None) -> bool:
    """Scan the tail of the shared agent-usage.ndjson for a quota/unavailable
    failure by `agent`. Reuses the reason field record_agent_usage already
    writes — no pipeline threading needed. `since_ms` bounds the scan to rows
    that ended at/after this worker started, so a concurrent sibling worker's
    (or a stale) quota row can't falsely trip the breaker."""
    import json
    quota_reasons = {"quota_or_rate_limit", "api_error_only_output", "empty_output"}
    path = Path(progress) / "agent-usage.ndjson"
    try:
        lines = path.read_text(errors="replace").splitlines()[-lookback:]
    except OSError:
        return False
    for ln in reversed(lines):
        try:
            row = json.loads(ln)
        except json.JSONDecodeError:
            continue
        if since_ms is not None and row.get("ended_ms", 0) < since_ms:
            continue
        model = row.get("model") or row.get("label", "")
        if agent in (row.get("label", ""), model) and row.get("reason") in quota_reasons:
            return True
    return False


__all__ = ["Dispatcher", "WorkerHandle", "subprocess_spawn"]
