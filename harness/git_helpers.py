"""Git helpers — real impls per design doc §7.4 + §10.

scope_audit: detect, classify, revert out-of-scope edits with the
untracked_before baseline (v5 design landing place — see doc §7.4).
commit_verified: stage + commit + assert HEAD advanced (lib.sh:1202-1228).
next_version_tag: v0.<n> per lib.sh:1245-1247.
"""
from __future__ import annotations

import fnmatch
import os
import stat
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class PathScope:
    allow: list[str] = field(default_factory=list)
    deny: list[str] = field(default_factory=list)


@dataclass
class ScopeAuditResult:
    in_scope: list[str] = field(default_factory=list)
    out_of_scope: list[str] = field(default_factory=list)
    had_violations: bool = False


def snapshot_untracked(workspace) -> set[str]:
    """Pre-call baseline of untracked paths."""
    try:
        out = workspace.status_porcelain(untracked=True)
    except Exception:
        return set()
    return {line[3:].strip() for line in out.splitlines() if line.startswith("?? ")}


def _match_any(path: str, patterns: list[str]) -> bool:
    if not patterns:
        return False
    norm = path.lstrip("./")
    for pat in patterns:
        if pat.endswith("/**"):
            base = pat[:-3]
            if norm == base or norm.startswith(base + "/"):
                return True
        elif fnmatch.fnmatch(norm, pat):
            return True
    return False


def _classify(path: str, scope: PathScope,
              safe_paths: "list[str] | None" = None) -> bool:
    """True iff IN scope. Precedence:
      1. safe_paths match → ALWAYS in-scope (overrides deny). These are
         the harness's own artifact / handoff / sub-ticket paths that
         a role must write to — declared by Role.execute, not the YAML.
      2. Deny match → out-of-scope.
      3. Allow match → in-scope.
      4. Else → out-of-scope (implicit deny).
    """
    if safe_paths and _match_any(path, safe_paths):
        return True
    if _match_any(path, scope.deny):
        return False
    if _match_any(path, scope.allow):
        return True
    return False


def scope_audit(workspace, head_before: str, untracked_before: set[str],
                scope: PathScope,
                safe_paths: "list[str] | None" = None) -> ScopeAuditResult:
    """Detect, classify, revert out-of-scope edits since the snapshot.

    Per doc §7.4: combines `git diff --name-status <head_before>` (tracked)
    with `git status --porcelain --untracked-files=all` minus
    `untracked_before` (new-since-call untracked files). v3's stale-untracked
    bug (which would rm -f pre-existing scratch files) is gone in v5.

    `safe_paths` is the v5.1 hotfix: the agent's own out_file lives under
    artifacts_dir (often inside `tickets/**` which the implementer scope
    denies), so without an overriding safe-list every implementer call
    would scope-violate on its own stdout capture. Role.execute populates
    safe_paths from artifacts_dir + caller-declared extras (handoff.md,
    subtickets dir for the decomposer, tickets root for split, etc.).
    """
    in_scope: list[str] = []
    out_of_scope: list[str] = []
    revert_modified: list[str] = []
    remove_paths: list[Path] = []

    try:
        diff_out = workspace.diff_since(head_before)
    except Exception:
        diff_out = ""
    for line in diff_out.splitlines():
        if not line.strip():
            continue
        parts = line.split("\t")
        status = parts[0]
        if status.startswith("R"):
            # Rename: treat the rename as ONE logical change. If EITHER end is
            # out-of-scope, restore BOTH paths together so the rename is fully
            # undone. v5.1 fix: prior version classified independently and
            # missed the in-scope-old → out-of-scope-new case (the in-scope
            # old path was DELETED by the rename but only the new path was
            # rolled back, leaving the old file gone). Reviewer #1 R1 blocker.
            old_path = parts[1] if len(parts) > 1 else ""
            new_path = parts[2] if len(parts) > 2 else ""
            old_in = _classify(old_path, scope, safe_paths)
            new_in = _classify(new_path, scope, safe_paths)
            if old_in and new_in:
                in_scope.extend([old_path, new_path])
            else:
                # Either side out-of-scope → rename is out-of-scope as a whole.
                # OLD path existed at head_before → checkout to restore content.
                # NEW path was CREATED by the rename, didn't exist at head_before
                # → rm -f from working tree (a checkout against head_before
                # would fail because the path is unknown to that commit).
                out_of_scope.extend([old_path, new_path])
                revert_modified.append(old_path)
                remove_paths.append(Path(workspace.root) / new_path)
            continue
        path = parts[1] if len(parts) > 1 else ""
        if _classify(path, scope, safe_paths):
            in_scope.append(path)
        else:
            out_of_scope.append(path)
            if status == "A":
                remove_paths.append(Path(workspace.root) / path)
            else:
                revert_modified.append(path)

    try:
        post_untracked = snapshot_untracked(workspace)
    except Exception:
        post_untracked = set()
    new_untracked = post_untracked - untracked_before
    for path in sorted(new_untracked):
        if _classify(path, scope, safe_paths):
            in_scope.append(path)
        else:
            out_of_scope.append(path)
            remove_paths.append(Path(workspace.root) / path)

    if revert_modified:
        try:
            workspace.checkout(revert_modified, ref=head_before)
        except Exception:
            pass
    for p in remove_paths:
        try:
            workspace.remove(p)
        except Exception:
            pass

    return ScopeAuditResult(
        in_scope=in_scope,
        out_of_scope=out_of_scope,
        had_violations=bool(out_of_scope),
    )


def commit_verified(workspace, message: str, *, include_harness: bool = False,
                    telemetry=None) -> bool:
    """Stage scoped paths + commit + assert HEAD advanced. Ports
    lib.sh::commit_verified (lib.sh:1202-1228). Returns True on success
    (incl. nothing-to-commit) or False on hard failure."""
    paths = ["."] if include_harness else [".", ":!harness"]
    try:
        workspace.stage(paths)
    except Exception:
        return False
    if workspace.diff_cached_quiet():
        _emit(telemetry, "commit_skipped", {"message": message, "reason": "no_changes"})
        return True
    result = workspace.commit(message)
    if not result.committed:
        _emit(telemetry, "commit_failed", {"message": message, "reason": "git_commit_failed"})
        return False
    if not result.head_advanced:
        _emit(telemetry, "commit_failed", {"message": message, "reason": "head_did_not_advance"})
        return False
    _emit(telemetry, "commit", {"message": message, "sha": result.sha})
    return True


def _emit(telemetry, event_type: str, payload: dict) -> None:
    if telemetry is None:
        return
    try:
        if hasattr(telemetry, "emit"):
            telemetry.emit(event_type, payload)
    except Exception:
        pass


def next_version_tag(workspace) -> str:
    """v0.<n> where n = (# existing v0.* tags) + 1."""
    existing = workspace.list_tags("v0.*")
    return f"v0.{len(existing) + 1}"


def chmod_a_minus_w(path: Path) -> None:
    try:
        st = path.stat()
    except OSError:
        return
    new_mode = st.st_mode & ~(stat.S_IWUSR | stat.S_IWGRP | stat.S_IWOTH)
    try:
        path.chmod(new_mode)
    except OSError:
        pass


def chmod_a_minus_w_recursive(path: Path) -> None:
    if not path.exists():
        return
    if path.is_file():
        chmod_a_minus_w(path)
        return
    for root, _dirs, files in os.walk(path):
        root_p = Path(root)
        for f in files:
            chmod_a_minus_w(root_p / f)


def chmod_u_plus_w(path: Path) -> None:
    if not path.exists():
        return
    try:
        st = path.stat()
        path.chmod(st.st_mode | stat.S_IWUSR)
    except OSError:
        pass


__all__ = [
    "PathScope", "ScopeAuditResult",
    "chmod_a_minus_w", "chmod_a_minus_w_recursive", "chmod_u_plus_w",
    "commit_verified", "next_version_tag", "scope_audit", "snapshot_untracked",
]
