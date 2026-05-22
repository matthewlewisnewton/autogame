"""Tests for harness.prompts.acceptance — VerdictAccept, ReviewAccept, OkRcAccept,
build_from_yaml. Covers doc §11.1 acceptance row + the ReviewAccept regression."""
from __future__ import annotations

import time
from pathlib import Path

import pytest

from harness.agents.base import AgentResult, FailureReason
from harness.prompts.acceptance import (
    OkRcAccept,
    ReviewAccept,
    VerdictAccept,
    build_from_yaml,
)


def _ok_result(stdout: str = "ok") -> AgentResult:
    now = time.time()
    return AgentResult(
        rc=0, reason=FailureReason.OK, exit_code=0,
        stdout=stdout, duration_s=0.1, started_at=now, ended_at=now,
    )


def _failed_result(reason: FailureReason = FailureReason.EMPTY_OUTPUT) -> AgentResult:
    now = time.time()
    return AgentResult(
        rc=2, reason=reason, exit_code=1,
        stdout="", duration_s=0.1, started_at=now, ended_at=now,
    )


# ---------------------------------------------------------------- VerdictAccept

class TestVerdictAccept:
    def test_accepts_pass(self, tmp_path):
        assert VerdictAccept().accepts(_ok_result("VERDICT: PASS\n"), None, tmp_path)

    def test_accepts_fail(self, tmp_path):
        assert VerdictAccept().accepts(_ok_result("VERDICT: FAIL\nReason: ...\n"), None, tmp_path)

    def test_rejects_no_verdict(self, tmp_path):
        assert not VerdictAccept().accepts(_ok_result("Some review prose."), None, tmp_path)

    def test_lowercase_rejected(self, tmp_path):
        """Bash regex was case-sensitive on the VERDICT keyword."""
        assert not VerdictAccept().accepts(_ok_result("verdict: pass"), None, tmp_path)

    def test_indented_rejected(self, tmp_path):
        """`^VERDICT` requires start-of-line — indented doesn't count."""
        assert not VerdictAccept().accepts(_ok_result("  VERDICT: PASS"), None, tmp_path)


# ---------------------------------------------------------------- ReviewAccept

class TestReviewAccept:
    def test_accepts_when_review_md_has_verdict(self, tmp_path):
        (tmp_path / "review.md").write_text("Reviewed all sub-tickets.\nVERDICT: APPROVE\n")
        # gaps.md / nits.md ABSENT — this should still pass (the v2/v3 regression).
        assert ReviewAccept().accepts(_ok_result("done"), None, tmp_path)

    def test_rejects_when_review_md_missing(self, tmp_path):
        # No review.md on disk and no transcript content to recover from.
        assert not ReviewAccept().accepts(_ok_result("done"), None, tmp_path)

    def test_rejects_when_review_md_present_but_no_verdict(self, tmp_path):
        (tmp_path / "review.md").write_text("Some prose with no verdict line.\n")
        assert not ReviewAccept().accepts(_ok_result("done"), None, tmp_path)

    def test_chat_mode_recovery_path(self, tmp_path):
        """Reviewer printed `review.md` content in chat. ReviewAccept must
        run recover_review_files() before deciding the tier failed."""
        transcript = (
            "Here is the review.\n"
            "\n"
            "`review.md` content:\n"
            "```markdown\n"
            "All ACs satisfied.\n"
            "VERDICT: APPROVE\n"
            "```\n"
        )
        assert ReviewAccept().accepts(_ok_result(transcript), None, tmp_path)
        # File was written by the recovery hook.
        assert (tmp_path / "review.md").exists()


# ---------------------------------------------------------------- OkRcAccept

class TestOkRcAccept:
    def test_accepts_ok_result(self, tmp_path):
        assert OkRcAccept().accepts(_ok_result(), None, tmp_path)

    def test_rejects_failed_result(self, tmp_path):
        assert not OkRcAccept().accepts(_failed_result(), None, tmp_path)


# ---------------------------------------------------------------- build_from_yaml

class TestBuildFromYaml:
    def test_none_returns_ok_rc(self):
        assert isinstance(build_from_yaml(None), OkRcAccept)

    def test_empty_dict_returns_ok_rc(self):
        assert isinstance(build_from_yaml({}), OkRcAccept)

    def test_verdict(self):
        assert isinstance(build_from_yaml({"kind": "verdict"}), VerdictAccept)

    def test_review(self):
        assert isinstance(build_from_yaml({"kind": "review"}), ReviewAccept)

    def test_review_with_filename_override(self):
        crit = build_from_yaml({"kind": "review", "review_filename": "report.md"})
        assert isinstance(crit, ReviewAccept)
        assert crit.review_filename == "report.md"

    def test_ok_rc(self):
        assert isinstance(build_from_yaml({"kind": "ok_rc"}), OkRcAccept)

    def test_unknown_kind_raises(self):
        with pytest.raises(ValueError):
            build_from_yaml({"kind": "nonsense"})
