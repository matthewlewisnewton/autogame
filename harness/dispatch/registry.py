"""AgentRegistry — eligibility, per-agent concurrency, and health.

The dispatcher's decision core. Given a ticket's difficulty it selects an agent
that is (a) eligible for that difficulty, (b) AVAILABLE (not circuit-broken),
and (c) below its concurrency cap — then tracks in-flight counts so caps hold
across concurrent workers. Selection follows a per-difficulty preference order
(e.g. medium → composer first, qwen as overflow) so the qwen box (cap 1) is
used as a primary for easy work but only overflows to medium when free.

Health (AVAILABLE/DISABLED) is persisted so a quota-disabled agent STAYS
disabled across a dispatcher restart — re-enable is a deliberate human act.
Thread-safe: workers release from their own threads.
"""
from __future__ import annotations

import json
import threading
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


class AgentRegistry:
    def __init__(self, specs: list[AgentSpec],
                 preference: dict[str, list[str]],
                 *, health_file: Optional[Path] = None):
        self._states: dict[str, _State] = {s.name: _State(s) for s in specs}
        self._pref = preference
        self._health_file = Path(health_file) if health_file else None
        self._lock = threading.Lock()
        self._load_health()

    # --- selection ------------------------------------------------------ #
    def select_and_acquire(self, difficulty: str) -> Optional[str]:
        """Atomically pick + reserve an agent for `difficulty`, honoring health,
        concurrency caps, and preference order. Returns the agent name (already
        acquired — caller must `release()` when done) or None if none free."""
        with self._lock:
            for name in self._pref.get(difficulty, []):
                st = self._states.get(name)
                if (st and st.health is AgentHealth.AVAILABLE
                        and difficulty in st.spec.eligible
                        and st.in_flight < st.spec.max_concurrency):
                    st.in_flight += 1
                    return name
            return None

    def release(self, name: str) -> None:
        with self._lock:
            st = self._states.get(name)
            if st and st.in_flight > 0:
                st.in_flight -= 1

    # --- circuit breaker ------------------------------------------------ #
    def disable(self, name: str, *, reason: str = "") -> None:
        with self._lock:
            st = self._states.get(name)
            if st:
                st.health = AgentHealth.DISABLED
                st.disabled_reason = reason or None
                self._save_health()

    def enable(self, name: str) -> None:
        with self._lock:
            st = self._states.get(name)
            if st:
                st.health = AgentHealth.AVAILABLE
                st.disabled_reason = None
                self._save_health()

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
        for name, reason in (data.get("disabled") or {}).items():
            st = self._states.get(name)
            if st:
                st.health = AgentHealth.DISABLED
                st.disabled_reason = reason

    def _save_health(self) -> None:
        if not self._health_file:
            return
        disabled = {n: (st.disabled_reason or "")
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
