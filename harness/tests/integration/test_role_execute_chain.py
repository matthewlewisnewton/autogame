"""Role.execute integration tests — fallback chain semantics with stub agents.

Doc §11.2 rows:
  - Sub-ticket where primary QA fails, fallback QA succeeds → fallback chain
  - Sub-ticket where all QA agents return no verdict → tool-failure escalation
  - Chain exhaustion → accepted_by is None
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import pytest

from harness.agents.base import (
    Agent,
    AgentInvocation,
    AgentResult,
    FailureReason,
    UsageKind,
)
from harness.git_helpers import PathScope
from harness.prompts.acceptance import OkRcAccept, VerdictAccept
from harness.roles import ChainResult, Role


# --- Test doubles --------------------------------------------------------- #

@dataclass
class StubAgent(Agent):
    """Deterministic agent: returns a pre-built AgentResult. Optionally
    writes a stdout marker to the invocation's outfile so acceptance
    criteria that read from disk see it."""
    name: str
    writable: bool = False
    bucket: str = "remote"
    canned_result: Optional[AgentResult] = None
    call_count: int = 0

    def run(self, invocation, workspace, *, telemetry):
        self.call_count += 1
        # Write the canned stdout to the outfile so tests that re-read it
        # behave like the real spawn() flow.
        if self.canned_result and self.canned_result.stdout:
            invocation.out_file.parent.mkdir(parents=True, exist_ok=True)
            invocation.out_file.write_text(self.canned_result.stdout)
        return self.canned_result or _ok_result("ok")


def _ok_result(stdout: str = "ok\n") -> AgentResult:
    now = time.time()
    return AgentResult(rc=0, reason=FailureReason.OK, exit_code=0,
                       stdout=stdout, duration_s=0.0,
                       started_at=now, ended_at=now)


def _failed_result(reason: FailureReason = FailureReason.EMPTY_OUTPUT) -> AgentResult:
    now = time.time()
    return AgentResult(rc=2, reason=reason, exit_code=1,
                       stdout="", duration_s=0.0,
                       started_at=now, ended_at=now)


def _verdict_result(verdict: str = "PASS") -> AgentResult:
    now = time.time()
    return AgentResult(rc=0, reason=FailureReason.OK, exit_code=0,
                       stdout=f"Review.\nVERDICT: {verdict}\n",
                       duration_s=0.0, started_at=now, ended_at=now)


def _make_role(name: str, primary: Agent, fallbacks: list[Agent],
               acceptance=None, prompt_template: Path | None = None) -> Role:
    return Role(
        name=name,
        primary=primary,
        fallbacks=fallbacks,
        timeout_s=10.0,
        prompt_template=prompt_template or Path("/dev/null"),
        acceptance=acceptance or OkRcAccept(),
        out_file="out.txt",
        usage_kind=UsageKind.QA,
        scope=PathScope(allow=[], deny=[]),
    )


# --- Tests ---------------------------------------------------------------- #

class TestPrimarySucceedsImmediately:
    def test_one_tier_one_call(self, tmp_path, monkeypatch):
        # Stub out render_prompt so Role.execute doesn't try to read /dev/null.
        monkeypatch.setattr("harness.roles.render_prompt", lambda p, **kw: "p")
        primary = StubAgent(name="stub-primary", canned_result=_ok_result())
        fallback = StubAgent(name="stub-fallback", canned_result=_ok_result())
        role = _make_role("test", primary, [fallback])
        result: ChainResult = role.execute(workspace=None, prompt_vars={},
                                            artifacts_dir=tmp_path)
        assert result.accepted_by is primary
        assert len(result.tiers) == 1
        assert primary.call_count == 1
        assert fallback.call_count == 0


class TestPrimaryFailsFallbackSucceeds:
    def test_chain_promotes(self, tmp_path, monkeypatch):
        monkeypatch.setattr("harness.roles.render_prompt", lambda p, **kw: "p")
        primary = StubAgent(name="stub-primary",
                            canned_result=_failed_result(FailureReason.EMPTY_OUTPUT))
        fallback = StubAgent(name="stub-fallback",
                             canned_result=_verdict_result("PASS"))
        role = _make_role("test", primary, [fallback],
                          acceptance=VerdictAccept())
        result = role.execute(workspace=None, prompt_vars={},
                              artifacts_dir=tmp_path)
        assert result.accepted_by is fallback
        assert len(result.tiers) == 2
        assert result.tiers[0].accepted is False
        assert result.tiers[0].reason_for_skip is FailureReason.EMPTY_OUTPUT
        assert result.tiers[1].accepted is True


class TestNoVerdictPromotes:
    def test_ok_call_but_no_verdict_falls_through(self, tmp_path, monkeypatch):
        """Agent ok=True but stdout has no verdict → tier rejected with
        reason 'no_acceptance'; next tier tries."""
        monkeypatch.setattr("harness.roles.render_prompt", lambda p, **kw: "p")
        primary = StubAgent(name="stub-primary",
                            canned_result=_ok_result("Some prose, no verdict.\n"))
        fallback = StubAgent(name="stub-fallback",
                             canned_result=_verdict_result("FAIL"))
        role = _make_role("test", primary, [fallback],
                          acceptance=VerdictAccept())
        result = role.execute(workspace=None, prompt_vars={},
                              artifacts_dir=tmp_path)
        assert result.accepted_by is fallback
        assert result.tiers[0].accepted is False
        assert result.tiers[0].reason_for_skip == "no_acceptance"


class TestChainExhausted:
    def test_all_tiers_fail(self, tmp_path, monkeypatch):
        monkeypatch.setattr("harness.roles.render_prompt", lambda p, **kw: "p")
        a = StubAgent(name="a", canned_result=_failed_result(FailureReason.EMPTY_OUTPUT))
        b = StubAgent(name="b", canned_result=_failed_result(FailureReason.TIMEOUT))
        c = StubAgent(name="c", canned_result=_failed_result(FailureReason.API_ERROR_ONLY_OUTPUT))
        role = _make_role("test", a, [b, c], acceptance=VerdictAccept())
        result = role.execute(workspace=None, prompt_vars={},
                              artifacts_dir=tmp_path)
        assert result.accepted_by is None
        assert len(result.tiers) == 3
        assert all(not t.accepted for t in result.tiers)
        assert result.tiers[0].reason_for_skip is FailureReason.EMPTY_OUTPUT
        assert result.tiers[1].reason_for_skip is FailureReason.TIMEOUT
        assert result.tiers[2].reason_for_skip is FailureReason.API_ERROR_ONLY_OUTPUT
        # Final result is the last attempt's AgentResult.
        assert result.final.reason is FailureReason.API_ERROR_ONLY_OUTPUT


class TestStopAtFirstAccepted:
    def test_no_calls_after_acceptance(self, tmp_path, monkeypatch):
        """Once a tier accepts, no further tiers are tried."""
        monkeypatch.setattr("harness.roles.render_prompt", lambda p, **kw: "p")
        primary = StubAgent(name="p", canned_result=_ok_result())
        b = StubAgent(name="b", canned_result=_failed_result())
        c = StubAgent(name="c", canned_result=_failed_result())
        role = _make_role("test", primary, [b, c], acceptance=OkRcAccept())
        role.execute(workspace=None, prompt_vars={}, artifacts_dir=tmp_path)
        assert primary.call_count == 1
        assert b.call_count == 0
        assert c.call_count == 0


class TestReadOnlyRoleSkipsScopeAudit:
    """Phase 5 regression: a role with empty `allow` (e.g. qa:* with
    `deny:["**"]`) MUST NOT run scope_audit even when the underlying
    agent is `writable=True`. scope_audit's `diff_since(HEAD)` returns
    ALL uncommitted state, including the prior step's (typically the
    implementer's) work. Running it on a read-only role silently reverts
    the implementer's changes — every QA call would then see an empty
    diff and FAIL. Discovered on ticket 055 cutover day."""

    def test_qa_role_with_writable_agent_does_not_invoke_scope_audit(
        self, tmp_path, monkeypatch
    ):
        monkeypatch.setattr("harness.roles.render_prompt", lambda p, **kw: "p")
        called: dict[str, int] = {"scope_audit": 0, "snapshot_untracked": 0}

        def _fake_audit(*args, **kwargs):
            called["scope_audit"] += 1
            from harness.git_helpers import ScopeAuditResult
            return ScopeAuditResult()

        def _fake_snap(*args, **kwargs):
            called["snapshot_untracked"] += 1
            return set()

        monkeypatch.setattr("harness.roles.scope_audit", _fake_audit)
        monkeypatch.setattr("harness.roles.snapshot_untracked", _fake_snap)

        qa_agent = StubAgent(name="qwen-as-judge", writable=True,
                              canned_result=_verdict_result("FAIL"))
        role = _make_role("qa:code", qa_agent, [],
                          acceptance=VerdictAccept())
        # Read-only role: empty allow, deny everything.
        role.scope = PathScope(allow=[], deny=["**"])

        class _Ws:
            root = "/repo"
            def head(self): return "abcdef"

        role.execute(workspace=_Ws(), prompt_vars={}, artifacts_dir=tmp_path)
        assert called["scope_audit"] == 0, "scope_audit must not run for read-only roles"
        assert called["snapshot_untracked"] == 0, "no point snapshotting when audit won't run"

    def test_writable_role_still_audits(self, tmp_path, monkeypatch):
        """The fix is targeted: roles with non-empty `allow` (e.g.
        implementer with `allow:["game/**"]`) still get scope_audit."""
        monkeypatch.setattr("harness.roles.render_prompt", lambda p, **kw: "p")
        called: dict[str, int] = {"scope_audit": 0}

        def _fake_audit(*args, **kwargs):
            called["scope_audit"] += 1
            from harness.git_helpers import ScopeAuditResult
            return ScopeAuditResult()

        monkeypatch.setattr("harness.roles.scope_audit", _fake_audit)
        monkeypatch.setattr("harness.roles.snapshot_untracked",
                             lambda *a, **kw: set())

        impl_agent = StubAgent(name="qwen-impl", writable=True,
                                canned_result=_ok_result())
        role = _make_role("implementer", impl_agent, [])
        role.scope = PathScope(allow=["game/**"], deny=["tickets/**"])

        class _Ws:
            root = "/repo"
            def head(self): return "abcdef"

        role.execute(workspace=_Ws(), prompt_vars={}, artifacts_dir=tmp_path)
        assert called["scope_audit"] == 1


class TestReviewRecoveryIntegratedInChain:
    def test_chat_mode_recovery_doesnt_promote(self, tmp_path, monkeypatch):
        """ReviewAccept's internal recovery should let a chat-mode-only
        reviewer still satisfy the chain — no fallback promotion."""
        from harness.prompts.acceptance import ReviewAccept

        monkeypatch.setattr("harness.roles.render_prompt", lambda p, **kw: "p")
        transcript = (
            "Here's the review:\n"
            "## review.md\n"
            "```\n"
            "All ACs satisfied.\n"
            "VERDICT: APPROVE\n"
            "```\n"
        )
        primary = StubAgent(name="primary", writable=True,
                            canned_result=_ok_result(transcript))
        fallback = StubAgent(name="fallback", writable=True,
                             canned_result=_ok_result("should not be called"))
        role = _make_role("review", primary, [fallback],
                          acceptance=ReviewAccept())
        result = role.execute(workspace=None, prompt_vars={},
                              artifacts_dir=tmp_path)
        assert result.accepted_by is primary
        assert fallback.call_count == 0
        # The recovery wrote review.md to artifacts_dir.
        assert (tmp_path / "review.md").exists()
