"""Subprocess wrapper for Agent CLI invocations.

Ports `lib.sh::_run_cli` (~lib.sh:731-805) and `cli_failure_reason`
(~lib.sh:297-314) + `cli_output_is_only_error` (~lib.sh:316-334) +
`cli_output_has_quota_error` (~lib.sh:336-353) into Python.

Behaviors preserved verbatim:
- `timeout -k 30 <tmo> <argv>` → SIGTERM at tmo, SIGKILL at tmo+grace.
- Retry on EMPTY_OUTPUT / API_ERROR_ONLY_OUTPUT / TIMEOUT /
  KILLED_AFTER_TIMEOUT / QUOTA_OR_RATE_LIMIT / TERMINATED_BY_SIGNAL.
- Don't retry on EXIT_NONZERO (genuine task-failure — let the role chain
  promote a different tier).
- Per-agent retry budget overridable via `retries=` arg (AgyAgent passes 0
  per the bash's `case "$label" in gemini|agy) max_retries=0`).
- Backoff sleep between attempts.
- Telemetry emit on every attempt: `agent_start` / `agent_retry` /
  `agent_finish`. Usage recorded on every attempt outcome.

Intentionally NOT ported:
- gemini quota fast-fail (lib.sh:758-770) — gemini CLI retired (doc §10).
  The OutputWatcher hook is left in the signature as the extension point
  if a future agent ever needs mid-flight watch-and-kill.

The post-call filesystem-delta capture for fixture recording (doc §11.3)
is NOT in spawn() — that's a separate Phase 4 concern. spawn() does only
process management + classification + telemetry.
"""

from __future__ import annotations

import os
import re
import signal
import subprocess
import threading
import time
from pathlib import Path
from typing import Callable, Optional

from harness.agents.base import (
    AgentInvocation,
    AgentResult,
    FailureReason,
)

# Sentinel-line patterns ported from cli_output_is_only_error (lib.sh:316-334).
# Each line stripped + non-empty; if EVERY non-blank line matches one of these,
# treat as API_ERROR_ONLY_OUTPUT.
_API_ERROR_PATTERNS = (
    re.compile(r"^\[API Error:"),
    re.compile(r"^API Error:"),
    re.compile(r"^Operation cancelled\.$"),
    re.compile(r"^Terminated$"),
)

# Terminal quota markers — substrings on a single line, case-insensitive.
# Ported from cli_output_has_quota_error. Transient "Attempt N failed: ...
# Retrying" lines DO NOT count; only a final-giveup line counts. The bash
# excludes lines matching /attempt\s+\d+\s+failed/i + /retry/i; we do the same.
_TRANSIENT_RETRY_RE = re.compile(r"attempt\s+\d+\s+failed.*retry", re.IGNORECASE)
_TERMINAL_QUOTA_SUBSTRINGS = (
    "exhausted your capacity on this model",
    "quota will reset after",
)

# Verdict marker — duplicated lightly here to break the import cycle with
# prompts/acceptance.py (which doesn't ship until Phase 3). Same regex as
# VerdictAccept will use.
_VERDICT_RE = re.compile(r"^VERDICT:\s*(PASS|FAIL)\b", re.MULTILINE)


# --- Output classifiers ---------------------------------------------------- #

def output_is_only_error(text: str) -> bool:
    """All non-blank lines match one of the API-error sentinel patterns.
    Mirrors `cli_output_is_only_error` (lib.sh:316-334)."""
    stripped = text.strip()
    if not stripped:
        return False  # bash returns 1 (false) on empty — empty is its own bucket
    lines = [ln.strip() for ln in stripped.splitlines() if ln.strip()]
    if not lines:
        return False
    return all(any(p.search(ln) for p in _API_ERROR_PATTERNS) for ln in lines)


def output_has_quota_error(text: str) -> bool:
    """Any non-transient line containing a terminal quota marker.
    Mirrors `cli_output_has_quota_error` (lib.sh:336-353)."""
    if not text:
        return False
    lower = text.lower()
    for raw_line in lower.split("\n"):
        line = raw_line.strip()
        if _TRANSIENT_RETRY_RE.search(line):
            continue
        if any(s in line for s in _TERMINAL_QUOTA_SUBSTRINGS):
            return True
    return False


def has_verdict(text: str) -> bool:
    """A `^VERDICT: PASS|FAIL` line exists. Mirrors `has_verdict` from
    lib.sh; duplicated so classify() can short-circuit the quota check
    when a verdict-bearing reviewer happens to mention quota text in its
    content. Phase-3 prompts/acceptance.py VerdictAccept uses the SAME regex."""
    return bool(_VERDICT_RE.search(text))


def classify(exit_code: int, stdout_text: str) -> FailureReason:
    """Single-bucket reason for the call.

    Ports cli_failure_reason (lib.sh:297-314). Same precedence:
      1. exit_code 124 → TIMEOUT (`timeout` SIGTERM)
      2. exit_code 137 → KILLED_AFTER_TIMEOUT (`timeout -k` SIGKILL)
      3. exit_code 143 → TERMINATED_BY_SIGNAL (external SIGTERM)
      4. empty stdout → EMPTY_OUTPUT
      5. quota text present AND no verdict line → QUOTA_OR_RATE_LIMIT
         (the has_verdict carve-out preserves the bash bugfix where a
         reviewer's content mentioning 'quota' shouldn't trigger this)
      6. all non-blank lines are API-error sentinels → API_ERROR_ONLY_OUTPUT
      7. exit_code != 0 → EXIT_NONZERO (exact rc lives on AgentResult.exit_code)
      8. else → OK
    """
    if exit_code == 124:
        return FailureReason.TIMEOUT
    if exit_code == 137:
        return FailureReason.KILLED_AFTER_TIMEOUT
    if exit_code == 143:
        return FailureReason.TERMINATED_BY_SIGNAL
    if not stdout_text.strip():
        return FailureReason.EMPTY_OUTPUT
    if output_has_quota_error(stdout_text) and not has_verdict(stdout_text):
        return FailureReason.QUOTA_OR_RATE_LIMIT
    if output_is_only_error(stdout_text):
        return FailureReason.API_ERROR_ONLY_OUTPUT
    if exit_code != 0:
        return FailureReason.EXIT_NONZERO
    return FailureReason.OK


# Reasons that DESERVE a retry (transient failures). EXIT_NONZERO is the
# bash's "exit_$rc" bucket and is treated as task-failure, not retried.
# SCOPE_VIOLATION is applied by scope_audit in Phase 4 and is also not
# retried here (the next role tier is the right recovery).
_RETRYABLE: frozenset = frozenset({
    FailureReason.EMPTY_OUTPUT,
    FailureReason.API_ERROR_ONLY_OUTPUT,
    FailureReason.QUOTA_OR_RATE_LIMIT,
    FailureReason.TIMEOUT,
    FailureReason.KILLED_AFTER_TIMEOUT,
    FailureReason.TERMINATED_BY_SIGNAL,
})


# --- Subprocess management ------------------------------------------------- #

OutputWatcher = Callable[[str], bool]
"""Mid-flight callback: receives the accumulated stdout text on each poll;
returns True to early-kill the process. Phase 2 doesn't use any watcher;
the parameter exists so the extension point matches the bash (the gemini
quota fast-fail hook lived in this slot)."""


def _run_with_timeout(
    argv: list[str],
    *,
    out_path: Path,
    timeout_s: float,
    grace_kill_s: float,
    cwd: Path,
    output_watch: Optional[OutputWatcher],
) -> tuple[int, float, float]:
    """Run argv once; return (exit_code, started_at, ended_at).

    - stdin from /dev/null (bash `</dev/null`) so a CLI that reads stdin
      doesn't inherit and stop on SIGTTIN.
    - stdout+stderr merged into out_path (bash `>"$out" 2>&1`).
    - Hard timeout via a timer thread: SIGTERM at timeout_s; SIGKILL at
      timeout_s+grace_kill_s. Matches `timeout -k 30 <tmo>`.
    - exit codes: 124 = SIGTERM (timed out), 137 = SIGKILL after grace,
      143 = external SIGTERM. Matches GNU coreutils `timeout` conventions
      so classify() can dispatch on the same numeric vocabulary as bash.
    """
    started_at = time.time()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("")  # bash `: >"$out"`

    fin = open(os.devnull, "rb")
    fout = open(out_path, "wb")
    try:
        # New process group → SIGTERM/SIGKILL reach the whole tree (the CLI may
        # spawn its own children; killing only the parent leaves them orphaned).
        proc = subprocess.Popen(
            argv,
            stdin=fin,
            stdout=fout,
            stderr=subprocess.STDOUT,
            cwd=str(cwd),
            start_new_session=True,
        )
    finally:
        fin.close()
        # fout stays open — Popen inherited the fd; we close it after wait.

    sigterm_fired = threading.Event()
    sigkill_fired = threading.Event()

    def _sigterm():
        if proc.poll() is None:
            try:
                os.killpg(proc.pid, signal.SIGTERM)
                sigterm_fired.set()
            except (ProcessLookupError, PermissionError):
                pass

    def _sigkill():
        if proc.poll() is None:
            try:
                os.killpg(proc.pid, signal.SIGKILL)
                sigkill_fired.set()
            except (ProcessLookupError, PermissionError):
                pass

    t_term = threading.Timer(timeout_s, _sigterm)
    t_kill = threading.Timer(timeout_s + grace_kill_s, _sigkill)
    t_term.daemon = True
    t_kill.daemon = True
    t_term.start()
    t_kill.start()

    try:
        if output_watch is not None:
            poll_interval = 0.25
            while proc.poll() is None:
                try:
                    text = out_path.read_text(errors="replace")
                except OSError:
                    text = ""
                if output_watch(text):
                    _sigterm()
                    break
                time.sleep(poll_interval)
        proc.wait()
    finally:
        t_term.cancel()
        t_kill.cancel()
        fout.close()
        # Reap the whole process group, even on a "clean" exit. qwen-code
        # (Node) forks sub-agents that can outlive the parent; if we don't
        # kill them here they continue to hold our stdout fd, keep writing
        # to the workspace, and pollute the NEXT iteration's scope_audit
        # with edits the next implementer never made (observed 2026-05-30:
        # iter-1 qwen exited rc=1 at minute 14 but its skill-extractor
        # children kept editing harness/ + TASKS.md for another 45 min,
        # causing iter-2 to be reverted + downgraded to SCOPE_VIOLATION).
        try:
            os.killpg(proc.pid, signal.SIGTERM)
            # Brief grace, then SIGKILL anything that didn't honour TERM.
            time.sleep(0.5)
            os.killpg(proc.pid, signal.SIGKILL)
        except (ProcessLookupError, PermissionError, OSError):
            pass

    ended_at = time.time()
    rc = proc.returncode if proc.returncode is not None else -1
    # Translate Python's signal-death rcs (-N) to the timeout(1) convention.
    if sigkill_fired.is_set():
        rc = 137
    elif sigterm_fired.is_set():
        rc = 124
    elif rc == -signal.SIGTERM:
        rc = 143
    elif rc < 0:
        rc = 128 + (-rc)  # POSIX shell encoding for any other signal
    return rc, started_at, ended_at


# --- Public API ------------------------------------------------------------ #

def spawn(
    argv: list[str],
    *,
    invocation: AgentInvocation,
    workspace,                                    # Workspace stub in Phase 2; real Repo in Phase 4
    telemetry=None,                               # TelemetrySink stub in Phase 2; real wiring in Phase 4
    label: str,
    bucket: str,
    retries: Optional[int] = None,                # None → env CLI_RETRIES (default 2). AgyAgent passes 0.
    retry_backoff_s: Optional[float] = None,      # None → env CLI_RETRY_BACKOFF (default 20)
    grace_kill_s: float = 30.0,
    output_watch: Optional[OutputWatcher] = None,
) -> AgentResult:
    """Run a CLI subprocess with timeout, classification, and retry.

    Returns AgentResult populated with rc / reason / exit_code / stdout /
    timing. The caller decides what to do with non-ok results (typically:
    let Role.execute fall through to the next fallback tier).
    """
    # Defaults: prefer tunables (the YAML knob), fall back to env, then hardcode.
    # gpt+claude impl-review item: pre-v5.1 spawn ignored tunables.cli_retries
    # entirely (read env only), so the documented YAML knob was dead. v5.1
    # plumbs it through get_tunables().
    if retries is None or retry_backoff_s is None:
        try:
            from harness.config.tunables import get_tunables
            tun = get_tunables()
        except Exception:
            tun = None
        if retries is None:
            if tun is not None:
                retries = tun.cli_retries
            else:
                retries = int(os.environ.get("CLI_RETRIES", "2"))
        if retry_backoff_s is None:
            if tun is not None:
                retry_backoff_s = float(tun.cli_retry_backoff_s)
            else:
                retry_backoff_s = float(os.environ.get("CLI_RETRY_BACKOFF", "20"))

    cwd = Path(getattr(workspace, "root", Path.cwd()))

    attempt = 1
    while True:
        if telemetry is not None and hasattr(telemetry, "agent_start"):
            telemetry.agent_start(label=label, outfile=str(invocation.out_file),
                                  attempt=attempt, timeout_s=invocation.timeout_s)

        rc, started_at, ended_at = _run_with_timeout(
            argv,
            out_path=invocation.out_file,
            timeout_s=invocation.timeout_s,
            grace_kill_s=grace_kill_s,
            cwd=cwd,
            output_watch=output_watch,
        )
        try:
            stdout_text = invocation.out_file.read_text(errors="replace")
        except OSError:
            stdout_text = ""

        reason = classify(rc, stdout_text)
        result = AgentResult(
            rc=(0 if reason is FailureReason.OK else 2),
            reason=reason,
            exit_code=rc,
            stdout=stdout_text,
            duration_s=ended_at - started_at,
            started_at=started_at,
            ended_at=ended_at,
        )

        if reason is FailureReason.OK:
            if telemetry is not None and hasattr(telemetry, "agent_finish"):
                telemetry.agent_finish(label=label, outfile=str(invocation.out_file),
                                       attempt=attempt, rc=rc, status="ok")
            if telemetry is not None and hasattr(telemetry, "record_agent_usage"):
                telemetry.record_agent_usage(label=label, result=result, attempt=attempt,
                                             usage_kind=invocation.usage_kind, bucket=bucket,
                                             prompt=invocation.prompt.body, status="ok")
            return result

        if reason not in _RETRYABLE or attempt > retries:
            if telemetry is not None and hasattr(telemetry, "agent_finish"):
                telemetry.agent_finish(label=label, outfile=str(invocation.out_file),
                                       attempt=attempt, rc=rc, status="tool_failure",
                                       reason=reason.value)
            if telemetry is not None and hasattr(telemetry, "record_agent_usage"):
                telemetry.record_agent_usage(label=label, result=result, attempt=attempt,
                                             usage_kind=invocation.usage_kind, bucket=bucket,
                                             prompt=invocation.prompt.body, status="tool_failure")
            return result

        if telemetry is not None and hasattr(telemetry, "agent_retry"):
            telemetry.agent_retry(label=label, outfile=str(invocation.out_file),
                                  attempt=attempt, rc=rc, reason=reason.value)
        if telemetry is not None and hasattr(telemetry, "record_agent_usage"):
            telemetry.record_agent_usage(label=label, result=result, attempt=attempt,
                                         usage_kind=invocation.usage_kind, bucket=bucket,
                                         prompt=invocation.prompt.body, status="retry")
        time.sleep(retry_backoff_s)
        attempt += 1


__all__ = [
    "OutputWatcher",
    "classify",
    "has_verdict",
    "output_has_quota_error",
    "output_is_only_error",
    "spawn",
]
