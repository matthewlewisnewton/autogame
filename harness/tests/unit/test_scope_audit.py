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


class TestScopeAuditSafePaths:
    """v5.1 fatal-bug regression: harness artifact paths must NOT trip
    scope_audit even when they'd otherwise match deny. Without this,
    every implementer call self-violates on its own stdout capture.
    """
    def test_safe_path_overrides_deny(self, repo):
        head_before = repo.head()
        untracked_before = snapshot_untracked(repo)
        # Simulate spawn() writing the implementer's out_file under
        # tickets/<>/subtickets/<>/artifacts/iter-1/qwen.txt.
        (repo.root / "tickets" / "047" / "subtickets" / "01" / "artifacts" / "iter-1").mkdir(parents=True)
        out_file = repo.root / "tickets" / "047" / "subtickets" / "01" / "artifacts" / "iter-1" / "qwen.txt"
        out_file.write_text("agent stdout capture\n")

        # Implementer-shape scope: allow game/, deny tickets/.
        scope = PathScope(allow=["game/**"], deny=["tickets/**"])

        # Without safe_paths, the artifact WOULD be classified out-of-scope
        # and rm -f'd. This was the fatal bug.
        result_without_safe = scope_audit(repo, head_before, untracked_before, scope)
        # Reset for the safe-paths version.
        out_file.parent.mkdir(parents=True, exist_ok=True)
        out_file.write_text("agent stdout capture\n")

        # With safe_paths covering the artifact dir, NOT a violation, file kept.
        artifacts_safe = "tickets/047/subtickets/01/artifacts/iter-1/**"
        result = scope_audit(repo, head_before, untracked_before, scope,
                              safe_paths=[artifacts_safe])
        assert not result.had_violations, f"safe_paths didn't override deny: {result.out_of_scope}"
        assert out_file.exists(), "safe-path-matched file was wrongly removed"

    def test_safe_path_also_protects_handoff(self, repo):
        """implementer also writes handoff.md outside artifacts_dir;
        callers pass it via extra_safe_paths."""
        head_before = repo.head()
        untracked_before = snapshot_untracked(repo)
        (repo.root / "tickets" / "047" / "subtickets" / "01").mkdir(parents=True)
        handoff = repo.root / "tickets" / "047" / "subtickets" / "01" / "handoff.md"
        handoff.write_text("# handoff\n")
        scope = PathScope(allow=["game/**"], deny=["tickets/**"])
        result = scope_audit(repo, head_before, untracked_before, scope,
                              safe_paths=["tickets/047/subtickets/01/handoff.md"])
        assert not result.had_violations
        assert handoff.exists()


class TestScopeAuditCrossScopeRename:
    """v5.1 fix: bash flagged that the rename loop classified independently
    and only restored out-of-scope sides. If old IS in-scope and new is
    out-of-scope, the rename deleted the in-scope file — that deletion
    must also be undone."""
    def test_cross_scope_rename_restores_both_sides(self, repo):
        head_before = repo.head()
        untracked_before = snapshot_untracked(repo)
        # Simulate: agent renamed game/a.js → harness/sneaky.js, then committed
        # so git diff sees it as R. Achieve this via git mv + commit.
        import subprocess as sp
        sp.run(["git", "mv", "game/a.js", "harness/sneaky.js"],
               cwd=str(repo.root), check=True)
        sp.run(["git", "commit", "-q", "-m", "rename"],
               cwd=str(repo.root), check=True)
        # Scope: game/** allowed, harness/** denied. The rename is
        # out-of-scope as a whole; both old and new should be restored.
        scope = PathScope(allow=["game/**"], deny=["harness/**"])
        result = scope_audit(repo, head_before, untracked_before, scope)
        assert result.had_violations
        # Both paths should appear in out_of_scope (treated as one rename).
        assert "game/a.js" in result.out_of_scope
        assert "harness/sneaky.js" in result.out_of_scope
        # Old file restored, new file removed.
        assert (repo.root / "game" / "a.js").exists(), \
            "in-scope old file was not restored after cross-scope rename"
