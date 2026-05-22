"""Repo — day-1 concrete workspace per design doc §7.1.

Plain methods, not interfaces. Phase 6's WorktreeWorkspace becomes the
second concrete class; the ABC gets extracted at that point from the
real shared seams.
"""
from __future__ import annotations

import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from harness.workspace.ports import PortAllocation, default_ports


@dataclass
class CommitResult:
    committed: bool
    head_advanced: bool
    sha: Optional[str]


@dataclass
class Repo:
    """Wraps the main checkout. Single writer, single port pair."""
    root: Path
    ports: PortAllocation = field(default_factory=default_ports)
    branch: str = "main"

    def run_git(self, *args: str, check: bool = True, capture: bool = True) -> str:
        cmd = ["git", *args]
        result = subprocess.run(
            cmd, cwd=str(self.root),
            capture_output=capture, text=True, check=check,
        )
        return result.stdout.rstrip() if capture else ""

    def head(self) -> str:
        return self.run_git("rev-parse", "HEAD")

    def head_short(self) -> str:
        return self.run_git("rev-parse", "--short", "HEAD")

    def diff_since(self, ref: str, paths: Optional[list[str]] = None) -> str:
        args = ["diff", "--name-status", ref]
        if paths:
            args += ["--", *paths]
        return self.run_git(*args)

    def status_porcelain(self, paths: Optional[list[str]] = None,
                          untracked: bool = True) -> str:
        args = ["status", "--porcelain"]
        if untracked:
            args.append("--untracked-files=all")
        if paths:
            args += ["--", *paths]
        return self.run_git(*args)

    def tag(self, name: str, message: Optional[str] = None) -> None:
        args = ["tag"]
        if message:
            args += ["-a", name, "-m", message]
        else:
            args.append(name)
        self.run_git(*args, capture=False)

    def list_tags(self, pattern: str = "v0.*") -> list[str]:
        out = self.run_git("tag", "-l", pattern)
        return [t for t in out.splitlines() if t.strip()]

    def checkout(self, paths: list[str], ref: str = "HEAD") -> None:
        if not paths:
            return
        self.run_git("checkout", ref, "--", *paths, capture=False)

    def remove(self, path: Path) -> None:
        if path.is_dir():
            import shutil
            shutil.rmtree(path, ignore_errors=True)
        elif path.exists() or path.is_symlink():
            path.unlink(missing_ok=True)

    def stage(self, paths: list[str]) -> None:
        """git add -- <paths>. Scoped — no `git add -A`."""
        if not paths:
            return
        self.run_git("add", "--", *paths, capture=False)

    def diff_cached_quiet(self) -> bool:
        try:
            self.run_git("diff", "--cached", "--quiet")
            return True
        except subprocess.CalledProcessError:
            return False

    def commit(self, message: str) -> CommitResult:
        if self.diff_cached_quiet():
            return CommitResult(committed=False, head_advanced=False, sha=None)
        before = self.head()
        try:
            self.run_git("commit", "-q", "-m", message, "-m", "autogame", capture=False)
        except subprocess.CalledProcessError:
            return CommitResult(committed=False, head_advanced=False, sha=None)
        after = self.head()
        return CommitResult(committed=True, head_advanced=(after != before),
                            sha=self.head_short() if after != before else None)


__all__ = ["CommitResult", "Repo"]
