"""AgentRegistry — eligibility, per-agent concurrency, and health.

The dispatcher's decision core. Given a ticket's difficulty it selects an agent
that is (a) eligible for that difficulty, (b) AVAILABLE (not circuit-broken),
and (c) below its concurrency cap — then tracks in-flight counts so caps hold
across concurrent workers. Selection walks a single global priority order
(cheapest first: qwen → composer → claude → gpt-5.5) and takes the first agent
that qualifies; eligibility (which difficulties an agent may take) does the rest,
so a cheap local agent is always preferred and the expensive remotes are only
reached when the cheaper ones are busy or ineligible.

Health (AVAILABLE/DISABLED) is persisted so a quota-disabled agent STAYS
disabled across a dispatcher restart — re-enable is a deliberate human act.
Thread-safe: workers release from their own threads.
"""
from __future__ import annotations

import json
import threading
import time
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Optional


class AgentHealth(str, Enum):
    AVAILABLE = "available"
    DISABLED = "disabled"


@dataclass(frozen=True)
class AgentSpec:
    name: str
    max_concurrency: int
    eligible: frozenset[str]  # difficulties this agent may take


@dataclass
class _State:
    spec: AgentSpec
    in_flight: int = 0
    health: AgentHealth = AgentHealth.AVAILABLE
    disabled_reason: Optional[str] = None
    # Epoch seconds at which a circuit-broken agent becomes eligible for a quota
    # RE-PROBE (not auto-available — it stays DISABLED until a probe succeeds).
    # None = disabled indefinitely (manual re-enable only, e.g. a human disable).
    probe_at: Optional[float] = None


class AgentRegistry:
    def __init__(self, specs: list[AgentSpec],
                 order: list[str],
                 *, health_file: Optional[Path] = None):
        self._states: dict[str, _State] = {s.name: _State(s) for s in specs}
        self._order = list(order)  # global priority, cheapest first
        self._health_file = Path(health_file) if health_file else None
        self._lock = threading.Lock()
        self._load_health()

    # --- selection ------------------------------------------------------ #
    def select_and_acquire(self, difficulty: str) -> Optional[str]:
        """Atomically pick + reserve an agent for `difficulty`: walk the global
        priority order and take the first agent that is eligible for this
        difficulty, AVAILABLE, and below its cap. Returns the agent name (already
        acquired — caller must `release()` when done) or None if none free."""
        with self._lock:
            for name in self._order:
                st = self._states.get(name)
                if (st and st.health is AgentHealth.AVAILABLE
                        and difficulty in st.spec.eligible
                        and st.in_flight < st.spec.max_concurrency):
                    st.in_flight += 1
                    return name
            return None

    def try_acquire(self, name: str, difficulty: str) -> bool:
        """Acquire a SPECIFIC agent for `difficulty` if it is eligible, available,
        and under its cap. Returns True (caller must release()) or False. Unlike
        select_and_acquire this ignores preference order — used to reserve qwen
        for a lane it's eligible for but not the preferred pick (e.g. medium)."""
        with self._lock:
            st = self._states.get(name)
            if (st and st.health is AgentHealth.AVAILABLE
                    and difficulty in st.spec.eligible
                    and st.in_flight < st.spec.max_concurrency):
                st.in_flight += 1
                return True
            return False

    def release(self, name: str) -> None:
        with self._lock:
            st = self._states.get(name)
            if st and st.in_flight > 0:
                st.in_flight -= 1

    # --- circuit breaker ------------------------------------------------ #
    def disable(self, name: str, *, reason: str = "", cooldown_s: Optional[float] = None) -> None:
        """Circuit-break an agent. `cooldown_s` schedules an automatic quota
        re-probe that many seconds out (the agent stays DISABLED until that probe
        succeeds — see due_for_probe/enable). cooldown_s=None means indefinite:
        manual re-enable only (used for a deliberate human disable)."""
        with self._lock:
            st = self._states.get(name)
            if st:
                st.health = AgentHealth.DISABLED
                st.disabled_reason = reason or None
                st.probe_at = (time.time() + cooldown_s) if cooldown_s is not None else None
                self._save_health()

    def enable(self, name: str) -> None:
        with self._lock:
            st = self._states.get(name)
            if st:
                st.health = AgentHealth.AVAILABLE
                st.disabled_reason = None
                st.probe_at = None
                self._save_health()

    def due_for_probe(self, *, now: Optional[float] = None) -> list[str]:
        """Disabled agents whose cooldown has elapsed — i.e. it's time to re-probe
        their quota. They stay unavailable until a probe actually succeeds (the
        dispatcher calls enable() on success, or disable(cooldown_s=…) to back
        off again on failure)."""
        t = time.time() if now is None else now
        with self._lock:
            return [n for n, st in self._states.items()
                    if st.health is AgentHealth.DISABLED
                    and st.probe_at is not None and t >= st.probe_at]

    def is_available(self, name: str) -> bool:
        with self._lock:
            st = self._states.get(name)
            return bool(st and st.health is AgentHealth.AVAILABLE)

    # --- introspection (live view / reconcile) ------------------------- #
    def snapshot(self) -> dict[str, dict]:
        with self._lock:
            return {
                name: {
                    "in_flight": st.in_flight,
                    "max_concurrency": st.spec.max_concurrency,
                    "health": st.health.value,
                    "disabled_reason": st.disabled_reason,
                    "probe_at": st.probe_at,
                    "eligible": sorted(st.spec.eligible),
                }
                for name, st in self._states.items()
            }

    def disabled_agents(self) -> list[str]:
        with self._lock:
            return [n for n, st in self._states.items()
                    if st.health is AgentHealth.DISABLED]

    # --- health persistence (survives restart) ------------------------- #
    def _load_health(self) -> None:
        if not self._health_file or not self._health_file.exists():
            return
        try:
            data = json.loads(self._health_file.read_text())
        except (OSError, json.JSONDecodeError):
            return
        for name, val in (data.get("disabled") or {}).items():
            st = self._states.get(name)
            if not st:
                continue
            st.health = AgentHealth.DISABLED
            # New format: {reason, probe_at} (preserves the auto-probe schedule
            # across a restart). Old format: a bare reason string (probe_at=None →
            # indefinite, matching the pre-cooldown behaviour).
            if isinstance(val, dict):
                st.disabled_reason = val.get("reason") or None
                st.probe_at = val.get("probe_at")
            else:
                st.disabled_reason = val or None
                st.probe_at = None

    def _save_health(self) -> None:
        if not self._health_file:
            return
        disabled = {n: {"reason": (st.disabled_reason or ""), "probe_at": st.probe_at}
                    for n, st in self._states.items()
                    if st.health is AgentHealth.DISABLED}
        try:
            self._health_file.parent.mkdir(parents=True, exist_ok=True)
            self._health_file.write_text(json.dumps({"disabled": disabled}, indent=2))
        except OSError as e:
            # Losing this silently would re-enable a quota-disabled agent on the
            # next restart — surface it so the operator notices.
            try:
                from harness.telemetry.logging import log
                log(f"[registry] FAILED to persist agent health to "
                    f"{self._health_file}: {e!r} — disabled state may not survive restart")
            except Exception:
                pass


__all__ = ["AgentRegistry", "AgentSpec", "AgentHealth"]
