"""Regression test for the Phase 4.2 rescue commit-gate fix.

Both impl-review reviewers flagged that the pre-v4.2 rescue.py called
commit_verified() unconditionally — so a tool-failed or scope-violated
rescue tier would still land a 'claude rescue implementation pass'
commit on HEAD before the caller bailed out with rc=2.

The fix gates the commit on chain.accepted_by is not None.
"""
from __future__ import annotations

import subprocess
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import pytest

from harness.agents.base import (
    Agent, AgentInvocation, AgentResult, FailureReason, UsageKind,
)
from harness.git_helpers import PathScope
from harness.prompts.acceptance import OkRcAccept
from harness.roles import Role
from harness.steps.rescue import rescue
from harness.workspace.ports import PortAllocation
from harness.workspace.repo import Repo


def _make_repo(tmp_path: Path) -> Repo:
    subprocess.run(["git", "init", "-q"], cwd=tmp_path, check=True)
    subprocess.run(["git", "config", "user.email", "t@e"], cwd=tmp_path, check=True)
    subprocess.run(["git", "config", "user.name", "T"], cwd=tmp_path, check=True)
    (tmp_path / "game").mkdir()
    (tmp_path / "game" / "main.js").write_text("// initial\n")
    subprocess.run(["git", "add", "."], cwd=tmp_path, check=True)
    subprocess.run(["git", "commit", "-q", "-m", "init"], cwd=tmp_path, check=True)
    return Repo(root=tmp_path, ports=PortAllocation())


@dataclass
class StubAgent(Agent):
    name: str
    writable: bool = True
    bucket: str = "remote"
    canned_result: Optional[AgentResult] = None

    def run(self, invocation, workspace, *, telemetry):
        invocation.out_file.parent.mkdir(parents=True, exist_ok=True)
        invocation.out_file.write_text(self.canned_result.stdout if self.canned_result else "")
        return self.canned_result or _ok()


def _ok(stdout: str = "ok\n") -> AgentResult:
    now = time.time()
    return AgentResult(rc=0, reason=FailureReason.OK, exit_code=0,
                       stdout=stdout, duration_s=0.0,
                       started_at=now, ended_at=now)


def _failed(reason: FailureReason = FailureReason.EMPTY_OUTPUT) -> AgentResult:
    now = time.time()
    return AgentResult(rc=2, reason=reason, exit_code=1, stdout="",
                       duration_s=0.0, started_at=now, ended_at=now)


def _rescue_role(agent) -> Role:
    return Role(
        name="rescue", primary=agent, fallbacks=[],
        timeout_s=10.0, prompt_template=Path("/dev/null"),
        acceptance=OkRcAccept(), out_file="rescue.txt",
        usage_kind=UsageKind.RESCUE,
        scope=PathScope(allow=["game/**"], deny=[]),
    )


class TestRescueCommitGate:
    def test_failed_rescue_does_not_commit(self, tmp_path, monkeypatch):
        monkeypatch.setattr("harness.roles.render_prompt", lambda p, **kw: "p")
        repo = _make_repo(tmp_path)
        head_before = repo.head()
        # Rescue agent fails (all tiers exhausted) and writes nothing meaningful.
        role = _rescue_role(StubAgent(name="stub-fail", canned_result=_failed()))
        # Make the workspace dirty in a way commit_verified WOULD pick up
        # (so we can prove the gate held: HEAD didn't advance even with
        # dirty workspace).
        (repo.root / "game" / "scratch.js").write_text("// leftover from earlier round\n")

        chain = rescue(role, workspace=repo, ticket_name="042-foo",
                        ticket_file=repo.root / "ticket.md",
                        review_fb=repo.root / "review-feedback.md",
                        base_ref=head_before, max_rounds=10,
                        rescue_dir=tmp_path / "rescue")
        assert chain.accepted_by is None
        # HEAD must NOT have advanced — the gate held.
        assert repo.head() == head_before, "rescue should NOT have committed; chain failed"

    def test_successful_rescue_commits(self, tmp_path, monkeypatch):
        monkeypatch.setattr("harness.roles.render_prompt", lambda p, **kw: "p")
        repo = _make_repo(tmp_path)
        head_before = repo.head()
        # Rescue agent succeeds. We simulate the agent making a game/ change
        # that commit_verified would stage.
        class WritingAgent(StubAgent):
            def run(self, invocation, workspace, *, telemetry):
                (workspace.root / "game" / "fix.js").write_text("// rescue fix\n")
                return super().run(invocation, workspace, telemetry=telemetry)
        role = _rescue_role(WritingAgent(name="stub-write", canned_result=_ok()))

        chain = rescue(role, workspace=repo, ticket_name="042-foo",
                        ticket_file=repo.root / "ticket.md",
                        review_fb=repo.root / "review-feedback.md",
                        base_ref=head_before, max_rounds=10,
                        rescue_dir=tmp_path / "rescue")
        assert chain.accepted_by is not None
        # HEAD advanced (the rescue commit landed).
        assert repo.head() != head_before, "successful rescue should have committed"
        # Commit message contains the expected prefix.
        last_msg = subprocess.run(
            ["git", "log", "-1", "--format=%s"], cwd=str(repo.root),
            capture_output=True, text=True,
        ).stdout.strip()
        assert "claude rescue implementation pass" in last_msg
