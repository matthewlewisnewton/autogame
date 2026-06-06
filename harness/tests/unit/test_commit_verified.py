"""Unit tests for git_helpers.commit_verified path selection."""
from __future__ import annotations

import subprocess
from pathlib import Path

import pytest

from harness.git_helpers import commit_verified
from harness.workspace.ports import PortAllocation
from harness.workspace.repo import Repo


def _make_repo(tmp_path: Path) -> Repo:
    subprocess.run(["git", "init", "-q"], cwd=tmp_path, check=True)
    subprocess.run(["git", "config", "user.email", "test@example.com"], cwd=tmp_path, check=True)
    subprocess.run(["git", "config", "user.name", "Test"], cwd=tmp_path, check=True)
    (tmp_path / "game").mkdir()
    (tmp_path / "game" / "main.js").write_text("// game\n")
    (tmp_path / "harness").mkdir()
    (tmp_path / "harness" / "tool.py").write_text("# harness\n")
    (tmp_path / "validation" / "rooms").mkdir(parents=True)
    (tmp_path / "validation" / "rooms" / "findings.md").write_text("# findings\n")
    subprocess.run(["git", "add", "."], cwd=tmp_path, check=True)
    subprocess.run(["git", "commit", "-q", "-m", "init"], cwd=tmp_path, check=True)
    return Repo(root=tmp_path, ports=PortAllocation())


def _files_in_head(repo: Repo) -> list[str]:
    out = subprocess.run(
        ["git", "show", "--name-only", "--pretty=", "HEAD"],
        cwd=str(repo.root), capture_output=True, text=True, check=True,
    )
    return [ln for ln in out.stdout.splitlines() if ln.strip()]


class TestCommitVerifiedPaths:
    def test_default_excludes_harness_includes_validation(self, tmp_path):
        repo = _make_repo(tmp_path)
        head_before = repo.head()
        (repo.root / "game" / "main.js").write_text("// changed\n")
        (repo.root / "harness" / "tool.py").write_text("# changed harness\n")
        (repo.root / "validation" / "rooms" / "findings.md").write_text("# updated\n")

        assert commit_verified(repo, "game + validation only")

        assert repo.head() != head_before
        files = _files_in_head(repo)
        assert "game/main.js" in files
        assert "validation/rooms/findings.md" in files
        assert "harness/tool.py" not in files

    def test_include_validation_stages_entire_tree(self, tmp_path):
        repo = _make_repo(tmp_path)
        head_before = repo.head()
        (repo.root / "harness" / "tool.py").write_text("# harness edit\n")
        (repo.root / "validation" / "rooms" / "findings.md").write_text("# committed\n")

        assert commit_verified(repo, "validation ticket commit", include_validation=True)

        assert repo.head() != head_before
        files = _files_in_head(repo)
        assert "validation/rooms/findings.md" in files
        assert "harness/tool.py" in files

    def test_include_harness_stages_entire_tree(self, tmp_path):
        repo = _make_repo(tmp_path)
        head_before = repo.head()
        (repo.root / "harness" / "tool.py").write_text("# harness edit\n")
        (repo.root / "validation" / "rooms" / "findings.md").write_text("# also staged\n")

        assert commit_verified(repo, "harness ticket commit", include_harness=True)

        assert repo.head() != head_before
        files = _files_in_head(repo)
        assert "harness/tool.py" in files
        assert "validation/rooms/findings.md" in files
