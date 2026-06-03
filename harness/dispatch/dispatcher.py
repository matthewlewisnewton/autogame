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

    _workers: dict[str, WorkerHandle] = field(default_factory=dict, init=False)
    _free_ports: list[PortAllocation] = field(default_factory=list, init=False)
    _backpressure_active: bool = field(default=False, init=False)

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
        self._reap()
        if self.merge_drain is not None:
            try:
                self.merge_drain()  # integrate one passed branch into main this tick
            except Exception as e:
                log(f"[dispatch] merge_drain raised (continuing tick): {e!r}")
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

    def idle(self) -> bool:
        """True when nothing is running and no lane has ready work."""
        if self._workers:
            return False
        return all(not self.queue.ready(difficulty=d, limit=1) for d in self.lanes)

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
            if self.on_pass is not None:
                self.on_pass(w)   # merge queue takes the branch + owns teardown
            else:
                w.worktree.remove_worktree()  # no merge queue wired → don't leak
            return True
        # Failure. If the agent itself hit quota/unavailability, trip the breaker.
        if self._hit_quota(w):
            log(f"[dispatch] {w.agent} hit quota/unavailable — disabling until re-enabled")
            self.registry.disable(w.agent, reason="quota or unavailable")
            emit_progress_event("agent_disabled", {"agent": w.agent, "reason": "quota"})
        self.queue.requeue(w.ticket_id, note=f"{w.agent} failed (rc={rc})")
        emit_progress_event("dispatch_requeue",
                            {"ticket": w.ticket_name, "agent": w.agent, "rc": rc})
        return w.worktree.remove_worktree()

    # --- run loop ------------------------------------------------------- #
    def run(self, *, max_idle_ticks: int = 0) -> None:
        """Poll-schedule-reap until idle (if max_idle_ticks>0) or forever."""
        idle_ticks = 0
        while True:
            self.tick()
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
