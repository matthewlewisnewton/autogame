"""render_prompt — port of lib.sh render_prompt (lib.sh:285-292).

Loads a template file and substitutes `__KEY__` markers with the given
values. Used to materialize prompts from harness/prompts/*.md before
sending to an Agent.

Quirk preserved: substitution is plain string replace (not regex). Bash:
    content="${content//__${1}__/$2}"
Python equivalent below. The marker convention `__KEY__` is preserved
verbatim; the existing prompt files (commit.md, decompose.md, etc.)
use this format and aren't being rewritten in the cutover.

§5.2 AgyAgent quirk: agy's workspaceDirs is always empty regardless of
cwd, so any `@file` references in the prompt must be absolute paths.
The Phase-3 renderer does NOT auto-absolutize — the caller is
responsible for passing absolute paths for any KEY whose value is
consumed by agy. The Pipeline already absolutizes paths
(run_subtask.sh:24); the Python pipeline will keep doing this in
Phase 4.
"""
from __future__ import annotations

from pathlib import Path
from typing import Mapping


def render_prompt(template_path: Path | str, /, **substitutions: str) -> str:
    """Read the template file and substitute `__KEY__` markers.

    Usage:
        render_prompt("harness/prompts/implement.md",
                      TICKET_FILE="/abs/path/ticket.md",
                      FEEDBACK_FILE="/abs/path/feedback.md",
                      HANDOFF_FILE="/abs/path/handoff.md")

    Equivalent to bash:
        render_prompt harness/prompts/implement.md \
            TICKET_FILE /abs/path/ticket.md \
            FEEDBACK_FILE /abs/path/feedback.md \
            HANDOFF_FILE /abs/path/handoff.md

    Unused markers in the template are left as-is (matching bash). Extra
    substitutions not used in the template are silently dropped.

    Raises FileNotFoundError if the template doesn't exist.
    """
    path = Path(template_path)
    content = path.read_text()
    return apply_substitutions(content, substitutions)


def apply_substitutions(content: str, substitutions: Mapping[str, str]) -> str:
    """The string-replace step, factored out so tests can exercise it
    without touching the filesystem."""
    for key, value in substitutions.items():
        content = content.replace(f"__{key}__", str(value))
    return content


__all__ = ["render_prompt", "apply_substitutions"]
