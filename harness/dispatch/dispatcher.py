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
import re
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


# Historical ticket names ("373-fix-foo") are already valid branch/dir
# components; operator-created beads have prose titles ("Server: fix X, Y")
# that git rejects as branch names ("auto/<title>") and that make terrible
# directory names. A clean title passes through verbatim (hand-authored
# tickets/<title>/ticket.md keep matching); anything else is slugified with
# the bead-id suffix appended for uniqueness.
_VALID_TICKET_NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$")


def ticket_dir_name(bead_id: str, title: str) -> str:
    t = (title or "").strip()
    if _VALID_TICKET_NAME.match(t) and ".." not in t and not t.endswith(".lock"):
        return t
    slug = re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", t.lower())).strip("-")
    slug = slug[:60].rstrip("-")
    suffix = (bead_id or "").strip().split("-")[-1] or "ticket"
    return f"{slug}-{suffix}" if slug else suffix


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
    # Merge-integration breaker (the dominant churn mode: a ticket that PASSES its
    # worker pipeline but repeatedly fails to integrate at the merge queue, so it
    # re-runs from scratch each reject — 171/210). The worker-side breaker above
    # can't see these (the worker keeps passing), so the merge queue reports them
    # via note_merge_reject(). Counted SEPARATELY and with lower limits, since each
    # merge reject is a whole completed ticket run (~tens of minutes), not a cheap
    # decompose failure. 0 = off (default; factory wires real values).
    breaker_merge_escalate: int = 0
    breaker_merge_abandon: int = 0
    # Requeue backoff: a failed ticket goes back to `open` immediately, but the
    # very next tick could re-claim it — on a persistent fast failure (e.g. an
    # agent billing block fast-bailing in seconds) that's a claim/fail hot-loop.
    # With a base > 0, a requeued ticket is not re-claimed until
    # base * 2^(attempts-1) seconds have passed (capped below). 0 = off (default
    # off so existing behaviour/tests are unchanged; the launcher wires a value).
    requeue_backoff_s: float = 0.0
    requeue_backoff_max_s: float = 1800.0
    # Wall-clock ceiling for a RUNNING worker (seconds). A wedged worker (hung
    # pnpm/vitest that escaped its own guard) otherwise holds its agent slot,
    # port pair, and worktree forever with zero signal. Past the ceiling it gets
    # SIGTERM (then SIGKILL a minute later) and flows through the normal failure
    # path on reap. 0 = off.
    worker_max_s: float = 0.0
    # Breaker/backoff state persistence. The attempt counters above are what
    # abandon a churning ticket — kept only in memory they reset on every factory
    # restart, so a ticket that should be abandoned can churn indefinitely across
    # restarts. None = no persistence (tests).
    state_file: Optional[Path] = None

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
    # Merge-integration breaker bookkeeping (separate from the worker-side counts,
    # which reset on a worker PASS — these must persist across the pass→merge-fail
    # →re-run cycle since the worker passes every time).
    _merge_rejects: dict[str, int] = field(default_factory=dict, init=False)
    _merge_first_seen: dict[str, float] = field(default_factory=dict, init=False)
    # Epoch seconds before which a requeued bead must not be re-claimed.
    _not_before: dict[str, float] = field(default_factory=dict, init=False)
    # Epoch seconds at which an over-ceiling worker was SIGTERMed (SIGKILL follows).
    _kill_sent: dict[str, float] = field(default_factory=dict, init=False)

    def __post_init__(self):
        self._free_ports = list(self.ports_pool)
        self._load_state()
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
            self._write_heartbeat()

    def _write_heartbeat(self) -> None:
        """Stamp progress/heartbeat.json every tick. `factory_status` events are
        deduped when unchanged, so without this a dispatcher stuck mid-merge for
        30 minutes looks identical to a healthy-but-quiet one. The file's mtime
        (and `ts`) is the liveness signal the live view/summary reads."""
        try:
            (progress_dir() / "heartbeat.json").write_text(json.dumps({
                "ts": int(time.time() * 1000),
                "workers": len(self._workers),
                "merge_pending": self.merge_pending() if self.merge_pending else 0,
                "cooling": len(self._not_before),
            }))
        except Exception:
            pass  # liveness telemetry must never break a tick

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
                if self._lane_head_cooling(difficulty):
                    break  # head-of-lane ticket is in requeue backoff — skip this tick
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
            if self._lane_head_cooling(lane):
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
        ticket_name = ticket_dir_name(bead_id, ticket_name)
        ports = self._free_ports.pop()
        try:
            wt = self.worktree_factory(ticket_name, ports)
        except Exception as e:  # creation failed → undo the claim + slot reservation
            log(f"[dispatch] worktree create failed for {ticket_name}: {e!r} — requeuing")
            self._free_ports.append(ports)
            self.registry.release(agent)
            self.queue.requeue(bead_id, note=f"worktree create failed: {e!r}")
            # Spawn failures repeat fast (no worker ran) — back off like any
            # other failure so a persistent infra error can't hot-loop the claim.
            self._note_backoff(bead_id, self._attempts.get(bead_id, 0) + 1)
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
            self._note_backoff(bead_id, self._attempts.get(bead_id, 0) + 1)
            return False
        self._workers[bead_id] = WorkerHandle(
            bead_id, ticket_name, agent, difficulty, wt, proc,
            started_at=int(time.time() * 1000))
        # Staleness-breaker bookkeeping: count this attempt and stamp first-seen
        # (the wall-clock the ticket FIRST started churning, kept across requeues).
        self._attempts[bead_id] = self._attempts.get(bead_id, 0) + 1
        self._first_seen.setdefault(bead_id, time.time())
        self._save_state()
        emit_progress_event("dispatch_spawn", {
            "ticket": ticket_name, "agent": agent, "difficulty": difficulty,
            "game_port": ports.game_server, "vite_port": ports.vite,
        })
        return True

    def _reap(self) -> None:
        for tid, w in list(self._workers.items()):
            rc = w.poll()
            if rc is None:
                self._watchdog(tid, w)
                continue
            self._kill_sent.pop(tid, None)
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

    def _watchdog(self, tid: str, w: WorkerHandle) -> None:
        """Bound a RUNNING worker's wall clock. Past `worker_max_s`, SIGTERM its
        process group (workers start their own session); if it's still alive 60s
        later, SIGKILL. The killed worker then exits and flows through the normal
        reap → _handle_outcome failure path next tick. Best-effort: a kill that
        fails (already-dead pid, fake proc in tests) is logged and retried."""
        if not self.worker_max_s or not w.started_at:
            return
        age_s = time.time() - (w.started_at / 1000.0)
        if age_s < self.worker_max_s:
            return
        import signal
        first_kill = self._kill_sent.get(tid)
        sig = signal.SIGTERM if first_kill is None else (
            signal.SIGKILL if time.time() - first_kill >= 60.0 else None)
        if sig is None:
            return  # TERM sent, still within its grace window
        try:
            pid = w.proc.pid  # type: ignore[attr-defined]
            os.killpg(os.getpgid(pid), sig)
        except Exception as e:
            log(f"[dispatch] watchdog kill of {w.ticket_name} failed: {e!r}")
            return
        if first_kill is None:
            self._kill_sent[tid] = time.time()
            log(f"[dispatch] WATCHDOG: {w.ticket_name} ({w.agent}) exceeded "
                f"{self.worker_max_s / 3600.0:.1f}h — SIGTERM sent")
            emit_progress_event("worker_timeout", {
                "ticket": w.ticket_name, "agent": w.agent,
                "hours": round(age_s / 3600.0, 2)})

    def _lane_head_cooling(self, difficulty: str) -> bool:
        """True when the lane's next ready ticket is still inside its requeue
        backoff window — the claim loop skips the lane this tick instead of
        re-claiming a ticket that just fast-failed. Reads (never claims), so a
        cooling head never causes beads write churn. Expired entries are pruned
        here, the only place that consults them."""
        if not self.requeue_backoff_s or not self._not_before:
            return False
        now = time.time()
        expired = [tid for tid, t in self._not_before.items() if t <= now]
        for tid in expired:
            del self._not_before[tid]
        if expired:
            self._save_state()
        if not self._not_before:
            return False
        try:
            rows = self.queue.ready(difficulty=difficulty, limit=1)
        except Exception:
            return False
        return bool(rows) and self._not_before.get(rows[0]["id"], 0) > now

    def _note_backoff(self, tid: str, attempts: int) -> None:
        """Stamp a requeued bead's no-reclaim-before time: base * 2^(attempts-1),
        capped. No-op when backoff is off."""
        if not self.requeue_backoff_s:
            return
        delay = min(self.requeue_backoff_s * (2 ** max(attempts - 1, 0)),
                    self.requeue_backoff_max_s)
        self._not_before[tid] = time.time() + delay
        self._save_state()

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
            self._note_backoff(w.ticket_id, self._attempts.get(w.ticket_id, 1))
            emit_progress_event("dispatch_requeue",
                                {"ticket": w.ticket_name, "agent": w.agent, "rc": rc})
        return w.worktree.remove_worktree()

    def _clear_breaker(self, tid: str) -> None:
        self._attempts.pop(tid, None)
        self._first_seen.pop(tid, None)
        self._not_before.pop(tid, None)
        self._save_state()

    def note_merge_reject(self, ticket_id: str, reason: str = "") -> bool:
        """Called by the merge queue when a PASSED branch fails to integrate.
        This is the churn mode the worker-side breaker misses — the worker passes
        every time, the failure is downstream at merge, and each reject re-runs the
        whole ticket from scratch. Count it; ESCALATE the ticket to a stronger
        agent past the escalate threshold; ABANDON it (close — return True so the
        merge queue does NOT requeue) past the abandon ceiling or the wall-clock
        limit. Best-effort: any error falls back to a normal requeue (return False)."""
        n = self._merge_rejects.get(ticket_id, 0) + 1
        self._merge_rejects[ticket_id] = n
        self._merge_first_seen.setdefault(ticket_id, time.time())
        self._save_state()
        elapsed_h = (time.time() - self._merge_first_seen.get(ticket_id, time.time())) / 3600.0

        hit_count = self.breaker_merge_abandon and n >= self.breaker_merge_abandon
        hit_hours = self.breaker_max_hours and elapsed_h >= self.breaker_max_hours
        if hit_count or hit_hours:
            r = (f"abandoned by merge-integration breaker: {n} merge failures, "
                 f"{elapsed_h:.1f}h (last: {reason})")
            try:
                self.queue.close(ticket_id, reason=r)
            except Exception as e:
                log(f"[dispatch] breaker close failed for {ticket_id}: {e!r} — requeuing")
                return False
            log(f"[dispatch] MERGE-BREAKER abandoned {ticket_id} — {r}")
            emit_progress_event("ticket_abandoned", {
                "ticket": ticket_id, "kind": "merge_integration",
                "merge_rejects": n, "hours": round(elapsed_h, 1)})
            self._merge_rejects.pop(ticket_id, None)
            self._merge_first_seen.pop(ticket_id, None)
            self._save_state()
            return True

        if self.breaker_merge_escalate and n >= self.breaker_merge_escalate:
            try:
                self.queue.set_difficulty(ticket_id, "hard")
                log(f"[dispatch] MERGE-BREAKER escalating {ticket_id} -> hard "
                    f"after {n} merge failures")
                emit_progress_event("ticket_escalated", {
                    "ticket": ticket_id, "to": "hard", "merge_rejects": n,
                    "kind": "merge_integration"})
            except Exception as e:
                log(f"[dispatch] merge-breaker escalate failed for {ticket_id}: {e!r}")
        # The merge queue requeues this ticket when we return False — give it the
        # same backoff a worker failure gets so it can't be re-claimed instantly.
        self._note_backoff(ticket_id, n)
        return False

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

    # --- breaker/backoff state persistence ------------------------------ #
    # The breaker counters decide when a churning ticket is escalated/abandoned;
    # in-memory only they reset on every factory restart, so a ticket that should
    # have been abandoned after N attempts can churn indefinitely across restarts.
    # Same pattern as the registry's agents_health.json: best-effort JSON, never
    # let persistence break a tick.
    def _load_state(self) -> None:
        if not self.state_file or not Path(self.state_file).exists():
            return
        try:
            data = json.loads(Path(self.state_file).read_text())
        except (OSError, json.JSONDecodeError):
            return
        self._attempts.update({k: int(v) for k, v in (data.get("attempts") or {}).items()})
        self._first_seen.update({k: float(v) for k, v in (data.get("first_seen") or {}).items()})
        self._merge_rejects.update({k: int(v) for k, v in (data.get("merge_rejects") or {}).items()})
        self._merge_first_seen.update(
            {k: float(v) for k, v in (data.get("merge_first_seen") or {}).items()})
        self._not_before.update({k: float(v) for k, v in (data.get("not_before") or {}).items()})

    def _save_state(self) -> None:
        if not self.state_file:
            return
        try:
            p = Path(self.state_file)
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(json.dumps({
                "attempts": self._attempts,
                "first_seen": self._first_seen,
                "merge_rejects": self._merge_rejects,
                "merge_first_seen": self._merge_first_seen,
                "not_before": self._not_before,
            }, indent=2))
        except OSError as e:
            log(f"[dispatch] WARN: could not persist breaker state to "
                f"{self.state_file}: {e!r}")

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
        if (agent in (row.get("label", ""), model, row.get("worker_agent"))
                and row.get("reason") in quota_reasons):
            return True
    return False


__all__ = ["Dispatcher", "WorkerHandle", "subprocess_spawn"]
