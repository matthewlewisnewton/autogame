"""subtask() pipeline integration tests with stub agents.

Doc §11.2:
- Single sub-ticket happy path with a stub agent that always passes
- Sub-ticket where implementer crashes once then succeeds
- SCOPE-CONFLICT sentinel exits 3
"""
from __future__ import annotations

import json
import subprocess
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import pytest

from harness.agents.base import (
    Agent, AgentInvocation, AgentResult, FailureReason, UsageKind,
)
from harness.config.tunables import (
    PipelineTunables, Tunables, VisionTunables,
)
from harness.git_helpers import PathScope
from harness.pipelines.subtask import SubtaskContext, subtask
from harness.prompts.acceptance import OkRcAccept, VerdictAccept
from harness.roles import Role
from harness.workspace.ports import PortAllocation
from harness.workspace.repo import Repo


# --- Helpers -------------------------------------------------------------- #

@dataclass
class StubAgent(Agent):
    name: str
    writable: bool = False
    bucket: str = "local"
    canned_results: list[AgentResult] = field(default_factory=list)
    canned_stdouts: list[str] = field(default_factory=list)
    call_count: int = 0
    # Optional side effect: on call N, write content to handoff.md
    write_handoff: Optional[Path] = None
    handoff_content: str = ""

    def run(self, invocation, workspace, *, telemetry):
        idx = self.call_count
        self.call_count += 1
        # Pick the result for this call (default to last if too many calls).
        result = (self.canned_results[idx] if idx < len(self.canned_results)
                  else (self.canned_results[-1] if self.canned_results else _ok("ok")))
        stdout = (self.canned_stdouts[idx] if idx < len(self.canned_stdouts)
                  else (self.canned_stdouts[-1] if self.canned_stdouts else result.stdout))
        invocation.out_file.parent.mkdir(parents=True, exist_ok=True)
        invocation.out_file.write_text(stdout)
        if self.write_handoff and self.handoff_content:
            self.write_handoff.write_text(self.handoff_content)
        return AgentResult(
            rc=result.rc, reason=result.reason, exit_code=result.exit_code,
            stdout=stdout, duration_s=result.duration_s,
            started_at=result.started_at, ended_at=result.ended_at,
        )


def _ok(stdout: str = "ok\n") -> AgentResult:
    now = time.time()
    return AgentResult(rc=0, reason=FailureReason.OK, exit_code=0,
                       stdout=stdout, duration_s=0.0,
                       started_at=now, ended_at=now)


def _fail(reason: FailureReason = FailureReason.EMPTY_OUTPUT) -> AgentResult:
    now = time.time()
    return AgentResult(rc=2, reason=reason, exit_code=1, stdout="",
                       duration_s=0.0, started_at=now, ended_at=now)


def _make_role(name, primary, fallbacks=None, *, writable=False, prompt_template=None,
               acceptance=None, out_file="out.txt", usage_kind=UsageKind.QA,
               scope_allow=None, scope_deny=None) -> Role:
    return Role(
        name=name, primary=primary, fallbacks=fallbacks or [],
        timeout_s=10.0,
        prompt_template=prompt_template or Path("/dev/null"),
        acceptance=acceptance or OkRcAccept(),
        out_file=out_file, usage_kind=usage_kind,
        scope=PathScope(allow=scope_allow or ["**"], deny=scope_deny or []),
    )


class _StubRoster:
    """Just enough of Roster's surface for SubtaskContext."""

    def __init__(self, roles_by_key: dict):
        self._roles = roles_by_key

    def role(self, name: str, *, difficulty: Optional[str] = None) -> Role:
        return self._roles[name]


def _make_tunables(*, max_iter=2, local_checks=False, vision=False) -> Tunables:
    return Tunables(
        max_iter=max_iter, ticket_max_rounds=3, game_url="http://localhost:5173",
        pipeline=PipelineTunables(local_checks=local_checks),
        vision=VisionTunables(feedback_on_fail=vision),
        qwen_disabled=False, cli_retries=0, cli_retry_backoff_s=0, agent_timeout_s=10,
    )


def _bootstrap_git_repo(root: Path) -> Repo:
    """Create a minimal git repo with a TASKS.md so subtask can run."""
    subprocess.run(["git", "init", "-q"], cwd=root, check=True)
    subprocess.run(["git", "config", "user.email", "test@example.com"], cwd=root, check=True)
    subprocess.run(["git", "config", "user.name", "Test"], cwd=root, check=True)
    (root / "game").mkdir()
    (root / "game" / "placeholder.txt").write_text("game code\n")
    (root / "TASKS.md").write_text("# Tasks\n")
    subprocess.run(["git", "add", "."], cwd=root, check=True)
    subprocess.run(["git", "commit", "-q", "-m", "init"], cwd=root, check=True)
    return Repo(root=root, ports=PortAllocation())


# --- Tests --------------------------------------------------------------- #

@pytest.fixture
def workspace(tmp_path) -> Repo:
    return _bootstrap_git_repo(tmp_path)


@pytest.fixture(autouse=True)
def _stub_game_subprocess(monkeypatch):
    """Pipeline tests don't actually start the game — that would need a
    real game/server/index.js + npx vite. Monkeypatch start_game /
    stop_game / wait_for_game / screenshot.capture to no-op so the
    pipeline structure is what's tested."""
    import harness.pipelines.subtask as st
    monkeypatch.setattr(st, "start_game", lambda *_a, **_kw: None)
    monkeypatch.setattr(st, "stop_game", lambda *_a, **_kw: None)
    monkeypatch.setattr(st, "wait_for_game", lambda *_a, **_kw: True)
    monkeypatch.setattr(st, "capture", lambda *_a, **_kw: True)
    # background_vitest returns None when local_checks=False (per tunables);
    # our tests pass local_checks=False so this is already a no-op.


@pytest.fixture
def subdir(workspace) -> Path:
    """Make a sub-ticket dir with ticket.md (code QA mode)."""
    d = workspace.root / "tickets" / "047-test" / "subtickets" / "01-thing"
    d.mkdir(parents=True)
    (d / "ticket.md").write_text(
        "# Thing\n\nDo a thing.\n\n## Verification: code\n"
    )
    return d


def _qa_pass_text() -> str:
    return "QA reviewed everything.\nVERDICT: PASS\n"


def _agent_that_modifies_game(name: str, workspace: Repo, *, writable=True) -> StubAgent:
    """Helper: a stub implementer that touches game/ on call (so commit_verified
    has something to stage)."""
    a = StubAgent(name=name, writable=writable)
    orig_run = a.run

    def run(invocation, ws, *, telemetry):
        # Write a small game file so there's a diff to commit.
        (workspace.root / "game" / "added.txt").write_text("by stub\n")
        return orig_run(invocation, ws, telemetry=telemetry)
    a.run = run  # type: ignore[assignment]
    a.canned_results = [_ok("implementer wrote files")]
    return a


class TestSubtaskHappyPath:
    def test_pass_on_iter_1_commits_and_marks_passed(self, workspace, subdir):
        impl = _agent_that_modifies_game("impl", workspace)
        qa_agent = StubAgent(name="qa", writable=False,
                              canned_stdouts=[_qa_pass_text()],
                              canned_results=[_ok(_qa_pass_text())])
        committer = StubAgent(name="committer", writable=True,
                                canned_results=[_ok()])
        roster = _StubRoster({
            "implementer": _make_role("implementer", impl,
                                       usage_kind=UsageKind.IMPLEMENTER),
            "qa:code": _make_role("qa:code", qa_agent,
                                    acceptance=VerdictAccept(), out_file="qa.txt"),
            "committer": _make_role("committer", committer,
                                     usage_kind=UsageKind.COMMITTER),
        })
        ctx = SubtaskContext(workspace=workspace, roster=roster, subdir=subdir,
                              label="047-test/01-thing",
                              tunables=_make_tunables(max_iter=2, local_checks=False))
        # Inject handoff.md before invocation so the sentinel-check
        # default behavior (empty handoff) is well-defined.
        (subdir / "handoff.md").write_text("(initial)\n")
        rc = subtask(ctx)
        assert rc == 0
        assert (subdir / ".passed").exists()
        # implementer + qa + committer each called exactly once
        assert impl.call_count == 1
        assert qa_agent.call_count == 1


class TestSubtaskScopeConflictExit:
    def test_sentinel_in_handoff_exits_3(self, workspace, subdir):
        impl = StubAgent(name="impl", writable=True,
                          canned_results=[_ok("done")],
                          write_handoff=subdir / "handoff.md",
                          handoff_content="<!-- HARNESS:SCOPE-CONFLICT -->\nSome reason.\n")
        qa_agent = StubAgent(name="qa", writable=False,
                              canned_stdouts=[_qa_pass_text()])
        committer = StubAgent(name="committer", writable=True,
                                canned_results=[_ok()])
        roster = _StubRoster({
            "implementer": _make_role("implementer", impl, usage_kind=UsageKind.IMPLEMENTER),
            "qa:code": _make_role("qa:code", qa_agent,
                                    acceptance=VerdictAccept(), out_file="qa.txt"),
            "committer": _make_role("committer", committer, usage_kind=UsageKind.COMMITTER),
        })
        ctx = SubtaskContext(workspace=workspace, roster=roster, subdir=subdir,
                              label="047-test/01-thing",
                              tunables=_make_tunables(max_iter=2))
        (subdir / "handoff.md").write_text("(initial)\n")
        rc = subtask(ctx)
        assert rc == 3
        # QA should never have run.
        assert qa_agent.call_count == 0


class TestSubtaskQAFail:
    def test_qa_fail_iter_1_pass_iter_2(self, workspace, subdir):
        impl = _agent_that_modifies_game("impl", workspace)
        impl.canned_results = [_ok("impl 1"), _ok("impl 2")]
        qa_pass = _qa_pass_text()
        qa_fail = "Looks broken.\nVERDICT: FAIL\n"
        qa_agent = StubAgent(
            name="qa", writable=False,
            canned_stdouts=[qa_fail, qa_pass],
            canned_results=[_ok(qa_fail), _ok(qa_pass)],
        )
        committer = StubAgent(name="committer", writable=True,
                                canned_results=[_ok()])
        roster = _StubRoster({
            "implementer": _make_role("implementer", impl, usage_kind=UsageKind.IMPLEMENTER),
            "qa:code": _make_role("qa:code", qa_agent,
                                    acceptance=VerdictAccept(), out_file="qa.txt"),
            "committer": _make_role("committer", committer, usage_kind=UsageKind.COMMITTER),
        })
        ctx = SubtaskContext(workspace=workspace, roster=roster, subdir=subdir,
                              label="047-test/01-thing",
                              tunables=_make_tunables(max_iter=2))
        (subdir / "handoff.md").write_text("(initial)\n")
        rc = subtask(ctx)
        assert rc == 0
        assert impl.call_count == 2          # ran iter 1 + iter 2
        assert qa_agent.call_count == 2      # ran iter 1 + iter 2
        assert (subdir / "feedback.md").exists(), "iter 1 should have written feedback"
        assert "FAIL" in (subdir / "feedback.md").read_text()
