"""Real-subprocess tests for spawn(). These exercise the full subprocess
lifecycle (Popen → wait → classify → retry) using /bin/sh so they're
hermetic — no real CLIs involved.

Doc §11.1 requirement: "hard timeout via asyncio.wait_for + process.
terminate/kill" — we use a timer-thread + os.killpg(SIGTERM/SIGKILL)
instead (per spawn.py's design). The behavioral requirement is the same:
a hung subprocess is actually killed within grace+1 seconds.
"""
from __future__ import annotations

import sys
import time
from pathlib import Path

import pytest

from harness.agents.base import (
    AgentInvocation,
    AgentResult,
    FailureReason,
    Prompt,
    UsageKind,
)
from harness.agents.spawn import spawn


class _NullWorkspace:
    """Workspace stub — spawn() reads .root via getattr fallback to cwd."""


def _make_invocation(out_file: Path, timeout_s: float = 5.0) -> AgentInvocation:
    return AgentInvocation(
        prompt=Prompt(body="test", template=Path("/dev/null")),
        timeout_s=timeout_s,
        out_file=out_file,
        usage_kind=UsageKind.QA,
    )


class TestSpawnHappyPath:
    def test_echo_returns_ok(self, tmp_path):
        out = tmp_path / "out.txt"
        inv = _make_invocation(out)
        result = spawn(["/bin/sh", "-c", "echo hello"],
                       invocation=inv, workspace=_NullWorkspace(),
                       label="test-echo", bucket="local", retries=0)
        assert result.ok
        assert result.reason is FailureReason.OK
        assert result.exit_code == 0
        assert "hello" in result.stdout
        assert out.read_text().strip() == "hello"


class TestSpawnFailureClassification:
    def test_empty_stdout_classified_as_empty_output(self, tmp_path):
        out = tmp_path / "out.txt"
        inv = _make_invocation(out)
        result = spawn(["/bin/sh", "-c", "exit 0"],
                       invocation=inv, workspace=_NullWorkspace(),
                       label="test-empty", bucket="local", retries=0)
        assert result.reason is FailureReason.EMPTY_OUTPUT
        assert result.rc == 2

    def test_nonzero_exit_with_output(self, tmp_path):
        out = tmp_path / "out.txt"
        inv = _make_invocation(out)
        result = spawn(["/bin/sh", "-c", "echo nope; exit 3"],
                       invocation=inv, workspace=_NullWorkspace(),
                       label="test-nonzero", bucket="local", retries=0)
        assert result.reason is FailureReason.EXIT_NONZERO
        assert result.exit_code == 3  # exact rc preserved
        assert result.rc == 2

    def test_api_error_only(self, tmp_path):
        out = tmp_path / "out.txt"
        inv = _make_invocation(out)
        result = spawn(["/bin/sh", "-c", "echo '[API Error: 500]'; exit 1"],
                       invocation=inv, workspace=_NullWorkspace(),
                       label="test-apierr", bucket="local", retries=0)
        assert result.reason is FailureReason.API_ERROR_ONLY_OUTPUT


class TestSpawnTimeout:
    def test_hung_subprocess_is_sigtermed_within_timeout(self, tmp_path):
        # Outer wall-clock assert (below) protects against hang; an
        # optional `@pytest.mark.timeout(N)` could replace it once
        # pytest-timeout is on the requirement list.
        """A sleep that exceeds timeout_s should be killed and classified TIMEOUT."""
        out = tmp_path / "out.txt"
        inv = _make_invocation(out, timeout_s=0.5)
        t0 = time.time()
        result = spawn(["/bin/sh", "-c", "echo started; sleep 5"],
                       invocation=inv, workspace=_NullWorkspace(),
                       label="test-timeout", bucket="local",
                       retries=0, grace_kill_s=1.0)
        elapsed = time.time() - t0
        # We should NOT have waited 5s; the SIGTERM fires at 0.5s,
        # SIGKILL at 1.5s. Give a generous ceiling for slow CI.
        assert elapsed < 4.0, f"spawn waited {elapsed:.1f}s — timeout didn't fire"
        assert result.reason is FailureReason.TIMEOUT
        assert result.exit_code == 124
        # We wrote something before the timeout, so stdout isn't empty
        assert "started" in result.stdout

    def test_subprocess_resisting_sigterm_gets_sigkill(self, tmp_path):
        """A subprocess that traps SIGTERM still dies via the grace SIGKILL."""
        out = tmp_path / "out.txt"
        inv = _make_invocation(out, timeout_s=0.3)
        t0 = time.time()
        result = spawn(
            ["/bin/sh", "-c", "trap '' TERM; echo started; sleep 10"],
            invocation=inv, workspace=_NullWorkspace(),
            label="test-resist", bucket="local",
            retries=0, grace_kill_s=0.5,
        )
        elapsed = time.time() - t0
        # SIGKILL fires at 0.3 + 0.5 = 0.8s; allow +1s slack for CI.
        assert elapsed < 3.0, f"resist-SIGTERM took {elapsed:.1f}s"
        assert result.reason is FailureReason.KILLED_AFTER_TIMEOUT
        assert result.exit_code == 137


class TestSpawnRetry:
    def test_retry_on_empty_then_success(self, tmp_path):
        """First attempt produces empty stdout; second succeeds. spawn() should retry.

        We achieve this by having the script touch a counter file and emit
        nothing on the first run, content on the second.
        """
        out = tmp_path / "out.txt"
        counter = tmp_path / "counter"
        script = f"""
        n=$(cat '{counter}' 2>/dev/null || echo 0)
        n=$((n + 1))
        echo $n > '{counter}'
        if [ "$n" -eq 1 ]; then
          exit 0  # empty output
        else
          echo "attempt $n"
        fi
        """
        inv = _make_invocation(out, timeout_s=5.0)
        # Use retry_backoff_s=0 to keep the test fast.
        result = spawn(["/bin/sh", "-c", script],
                       invocation=inv, workspace=_NullWorkspace(),
                       label="test-retry", bucket="local",
                       retries=2, retry_backoff_s=0)
        assert result.ok, f"reason={result.reason}, stdout={result.stdout!r}"
        assert "attempt 2" in result.stdout
        assert int(counter.read_text().strip()) == 2

    def test_no_retry_on_exit_nonzero(self, tmp_path):
        """EXIT_NONZERO is not in the retryable set — fails fast even with retries=5."""
        out = tmp_path / "out.txt"
        counter = tmp_path / "counter"
        script = f"""
        n=$(cat '{counter}' 2>/dev/null || echo 0)
        n=$((n + 1))
        echo $n > '{counter}'
        echo "attempt $n"
        exit 1
        """
        inv = _make_invocation(out, timeout_s=5.0)
        result = spawn(["/bin/sh", "-c", script],
                       invocation=inv, workspace=_NullWorkspace(),
                       label="test-no-retry", bucket="local",
                       retries=5, retry_backoff_s=0)
        assert result.reason is FailureReason.EXIT_NONZERO
        assert int(counter.read_text().strip()) == 1  # ran only once

    def test_agy_style_zero_retries(self, tmp_path):
        """AgyAgent passes retries=0; even retryable failures don't retry."""
        out = tmp_path / "out.txt"
        counter = tmp_path / "counter"
        script = f"""
        n=$(cat '{counter}' 2>/dev/null || echo 0)
        n=$((n + 1))
        echo $n > '{counter}'
        exit 0  # empty output → EMPTY_OUTPUT, normally retryable
        """
        inv = _make_invocation(out, timeout_s=5.0)
        result = spawn(["/bin/sh", "-c", script],
                       invocation=inv, workspace=_NullWorkspace(),
                       label="test-agy-zero", bucket="remote",
                       retries=0, retry_backoff_s=0)
        assert result.reason is FailureReason.EMPTY_OUTPUT
        assert int(counter.read_text().strip()) == 1
