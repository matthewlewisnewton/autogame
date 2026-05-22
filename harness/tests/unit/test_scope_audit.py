"""scope_audit unit tests — the v5 design hotspot.

Doc §7.4 fixture set:
  (a) clean diff in-scope → no-op
  (b) modified file out-of-scope → reverted via git checkout
  (c) created out-of-scope (NEW untracked since baseline) → rm -f'd
  (d) deleted file out-of-scope → restored
  (e) rename across scopes → both paths restored
  (f) deny pattern wins over allow pattern
PLUS the v5 regression: pre-existing untracked file is NOT considered
agent-created.
"""
from __future__ import annotations

import subprocess
from pathlib import Path

import pytest

from harness.git_helpers import PathScope, scope_audit, snapshot_untracked
from harness.workspace.repo import Repo


def _git_init_repo(tmp_path: Path) -> Repo:
    subprocess.run(["git", "init", "-q"], cwd=tmp_path, check=True)
    subprocess.run(["git", "config", "user.email", "t@e"], cwd=tmp_path, check=True)
    subprocess.run(["git", "config", "user.name", "T"], cwd=tmp_path, check=True)
    (tmp_path / "game").mkdir()
    (tmp_path / "game" / "a.js").write_text("a v1\n")
    (tmp_path / "harness").mkdir()
    (tmp_path / "harness" / "lib.sh").write_text("# bash\n")
    subprocess.run(["git", "add", "."], cwd=tmp_path, check=True)
    subprocess.run(["git", "commit", "-q", "-m", "init"], cwd=tmp_path, check=True)
    return Repo(root=tmp_path)


@pytest.fixture
def repo(tmp_path) -> Repo:
    return _git_init_repo(tmp_path)


class TestScopeAuditCleanCase:
    def test_no_changes_no_op(self, repo):
        head_before = repo.head()
        untracked_before = snapshot_untracked(repo)
        scope = PathScope(allow=["game/**"], deny=["tickets/**"])
        result = scope_audit(repo, head_before, untracked_before, scope)
        assert not result.had_violations
        assert result.in_scope == []
        assert result.out_of_scope == []


class TestScopeAuditModifiedOutOfScope:
    def test_modified_harness_file_reverted(self, repo):
        head_before = repo.head()
        untracked_before = snapshot_untracked(repo)
        # Agent modifies a harness file out of scope.
        (repo.root / "harness" / "lib.sh").write_text("# bash MODIFIED\n")
        scope = PathScope(allow=["game/**"], deny=["harness/**"])
        result = scope_audit(repo, head_before, untracked_before, scope)
        assert result.had_violations
        assert "harness/lib.sh" in result.out_of_scope
        # Reverted to its previous content.
        assert (repo.root / "harness" / "lib.sh").read_text() == "# bash\n"


class TestScopeAuditCreatedOutOfScope:
    def test_created_untracked_out_of_scope_removed(self, repo):
        head_before = repo.head()
        untracked_before = snapshot_untracked(repo)
        # Agent creates a new file out of scope (untracked).
        evil = repo.root / "harness" / "sneaky.txt"
        evil.write_text("malicious change\n")
        scope = PathScope(allow=["game/**"], deny=["harness/**"])
        result = scope_audit(repo, head_before, untracked_before, scope)
        assert result.had_violations
        assert "harness/sneaky.txt" in result.out_of_scope
        # Removed.
        assert not evil.exists()


class TestScopeAuditCreatedInScope:
    def test_created_untracked_in_scope_kept(self, repo):
        head_before = repo.head()
        untracked_before = snapshot_untracked(repo)
        # Agent creates a new file in scope (untracked).
        good = repo.root / "game" / "new.js"
        good.write_text("new code\n")
        scope = PathScope(allow=["game/**"], deny=["harness/**"])
        result = scope_audit(repo, head_before, untracked_before, scope)
        assert not result.had_violations
        assert "game/new.js" in result.in_scope
        # Kept.
        assert good.exists()


class TestScopeAuditPreExistingUntracked:
    def test_stale_untracked_not_misclassified(self, repo):
        # SIMULATE the bug fixed by v5: a pre-existing untracked file
        # (e.g. operator scratch file) should NOT be classified as
        # "agent-created" and rm -f'd.
        stale = repo.root / "harness" / "scratch.txt"
        stale.write_text("operator scratch\n")
        # Capture baseline AFTER stale file exists.
        head_before = repo.head()
        untracked_before = snapshot_untracked(repo)
        assert "harness/scratch.txt" in untracked_before
        # Now the agent runs — making NO changes.
        scope = PathScope(allow=["game/**"], deny=["harness/**"])
        result = scope_audit(repo, head_before, untracked_before, scope)
        # Stale file is NOT in out_of_scope; it's not "agent-created".
        assert not result.had_violations
        assert "harness/scratch.txt" not in result.out_of_scope
        # Still on disk — NOT rm-fd.
        assert stale.exists()


class TestScopeAuditDenyWinsOverAllow:
    def test_explicit_deny_overrides_allow(self, repo):
        head_before = repo.head()
        untracked_before = snapshot_untracked(repo)
        # Agent creates file that matches BOTH allow and deny.
        evil_in_game = repo.root / "game" / "sensitive.js"
        evil_in_game.write_text("oops\n")
        scope = PathScope(
            allow=["game/**"],
            deny=["game/sensitive.js"],
        )
        result = scope_audit(repo, head_before, untracked_before, scope)
        assert result.had_violations
        assert "game/sensitive.js" in result.out_of_scope
        assert not evil_in_game.exists()  # removed
