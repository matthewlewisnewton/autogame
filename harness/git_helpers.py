"""Git helpers — scope_audit, snapshot_untracked, commit_verified,
next_version_tag, chmod helpers.

Phase 3 lands the type surface (so roles.py imports compile) + a no-op
scope_audit stub. Phase 4 fills the real algorithm per design doc §7.4
including the untracked_before baseline (§7.4 was the v5 hotspot;
implementation arrives in Phase 4 alongside the workspace/repo.py
methods scope_audit calls).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class PathScope:
    """Allow/deny path-glob lists. Deny wins over allow; absence-from-allow
    implies deny (explicit allow-list semantics). See design doc §7.4."""
    allow: list[str] = field(default_factory=list)
    deny: list[str] = field(default_factory=list)


@dataclass
class ScopeAuditResult:
    """Per-call result of scope_audit. Empty in_scope / out_of_scope
    means the agent made no changes the audit could see; this is the
    normal case for read-only agents (which Role.execute skips audit on
    entirely, so they don't even build one of these)."""
    in_scope: list[str] = field(default_factory=list)
    out_of_scope: list[str] = field(default_factory=list)
    had_violations: bool = False


# --- Phase 3 stubs -------------------------------------------------------- #
# These return safe no-op results so roles.py / pipelines compile and tests
# can construct Role chains. Phase 4 replaces the bodies per §7.4.


def snapshot_untracked(workspace) -> set[Path]:
    """Pre-call baseline of untracked paths. Phase 4 implements via
    `git status --porcelain --untracked-files=all` per §7.4. Phase 3
    stub returns empty so any scope_audit comparison treats every
    post-call untracked file as "agent-created" — which makes the
    Phase-3 stub overly strict in the rare case it's actually run. Tests
    that exercise scope_audit pre-Phase-4 should mock this.
    """
    return set()


def scope_audit(workspace, head_before: str, untracked_before: set[Path],
                scope: PathScope) -> ScopeAuditResult:
    """Detect, classify, revert out-of-scope edits. Phase 4 fills the
    algorithm per design doc §7.4. Phase 3 returns a clean result so
    Role.execute's per-tier audit pass is a no-op until Phase 4 lands
    the real workspace methods."""
    return ScopeAuditResult(in_scope=[], out_of_scope=[], had_violations=False)


# --- commit_verified / tag — placeholders until Phase 4 ------------------- #

def commit_verified(workspace, message: str, paths: list[str]) -> str:
    """Phase 4 implements; stub raises so any accidental Phase-3 call
    fails loudly."""
    raise NotImplementedError("commit_verified lands in Phase 4 — see design doc §10.")


def next_version_tag(workspace) -> str:
    """Phase 4 implements; stub raises."""
    raise NotImplementedError("next_version_tag lands in Phase 4 — see design doc §10.")


__all__ = [
    "PathScope",
    "ScopeAuditResult",
    "commit_verified",
    "next_version_tag",
    "scope_audit",
    "snapshot_untracked",
]
