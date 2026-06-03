"""Cheap, ISOLATED quota probe for circuit-broken remote agents.

When the dispatcher disables a remote agent (cursor/claude) on a quota dip, it
schedules a re-probe (registry.due_for_probe). This module runs that probe: a
trivial "reply OK" call to the agent's CLI, in a THROWAWAY temp directory — never
the main checkout or a live worktree — so a misbehaving agent can't touch the
repo (cf. the agy print-mode incident that corrupted harness/node_modules). The
call's output is run through the same `classify()` the real pipeline uses, so the
new cursor quota substrings are honoured here too: quota still out → don't
re-enable; a clean OK → the agent's quota is back.

Only `bucket == "remote"` agents are probed; qwen is local and doesn't quota-fail.
"""
from __future__ import annotations

import subprocess
import tempfile
from typing import Optional

from harness.agents.base import FailureReason
from harness.agents.spawn import classify
from harness.telemetry.logging import log

_PROBE_PROMPT = "Reply with exactly: OK"


def probe_agent_quota(agent, *, timeout_s: float = 30.0,
                      runner=subprocess.run) -> Optional[bool]:
    """Probe whether `agent`'s quota is back. Returns:
      True  → a clean response (quota recovered → safe to re-enable),
      False → quota still out / the call failed (keep it disabled, back off),
      None  → can't determine (local agent, missing CLI, odd backend) → leave as-is.

    `agent` is an Agent backend instance (roster.agents[name]). Runs the probe in
    a fresh tempdir as cwd. `runner` is injected for tests."""
    if agent is None:
        return None
    if getattr(agent, "bucket", "remote") != "remote":
        return None  # local (qwen) — not quota-limited; nothing to probe
    try:
        argv = agent._build_argv(_PROBE_PROMPT)  # cursor/claude share this 1-arg form
    except (TypeError, AttributeError):
        return None  # unexpected backend shape — don't guess
    try:
        with tempfile.TemporaryDirectory(prefix="quota-probe-") as scratch:
            proc = runner(argv, cwd=scratch, capture_output=True, text=True,
                          timeout=timeout_s)
    except subprocess.TimeoutExpired:
        log(f"[quota-probe] {getattr(agent, 'name', '?')} timed out — treating as still out")
        return False
    except (FileNotFoundError, OSError) as e:
        log(f"[quota-probe] {getattr(agent, 'name', '?')} could not run ({e!r}) — undetermined")
        return None
    out = (getattr(proc, "stdout", "") or "") + "\n" + (getattr(proc, "stderr", "") or "")
    reason = classify(getattr(proc, "returncode", 1), out)
    recovered = reason is FailureReason.OK
    log(f"[quota-probe] {getattr(agent, 'name', '?')}: "
        f"{'recovered' if recovered else f'still out ({reason.value})'}")
    return recovered


__all__ = ["probe_agent_quota"]
