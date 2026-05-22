"""revert_game_changes — port of lib.sh::revert_game_changes (lib.sh:1240-1243).

Discards uncommitted changes from a failed sub-ticket attempt; preserves
harness/ and tickets/ (in-flight operator state + per-ticket bookkeeping).
"""
from __future__ import annotations

import subprocess


def revert_game_changes(workspace) -> None:
    """`git checkout HEAD -- . :!harness :!tickets` +
    `git clean -fdq -- . :!harness :!tickets`."""
    for args in (
        ["checkout", "HEAD", "--", ".", ":!harness", ":!tickets"],
        ["clean", "-fdq", "--", ".", ":!harness", ":!tickets"],
    ):
        try:
            subprocess.run(["git", *args], cwd=str(workspace.root),
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                           check=False)
        except OSError:
            pass


__all__ = ["revert_game_changes"]
