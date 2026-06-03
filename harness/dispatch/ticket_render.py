"""Render a worker's ticket.md from a bead's fields.

A worker reads its spec from `<worktree>/tickets/<name>/ticket.md`. Beads
created without a committed ticket.md (operator/raw `bd create`) would leave the
worker with no spec to act on. `render_ticket_md` materializes that file from
the bead dict at spawn time — but only when one isn't already present, so a
hand-authored spec on disk always wins.

Field names vary across bead sources, so everything is pulled defensively with
`.get` and missing pieces are simply skipped. A malformed bead never raises:
the worst case is returning False and leaving the filesystem untouched.
"""
from __future__ import annotations

from pathlib import Path


def _as_lines(value) -> list[str]:
    """Normalize an acceptance-like field into a list of non-empty trimmed
    strings. Accepts a list/tuple (each item one entry) or a string (split on
    newlines). Anything else → []."""
    items: list = []
    if isinstance(value, str):
        items = value.splitlines()
    elif isinstance(value, (list, tuple)):
        items = list(value)
    out = []
    for it in items:
        if it is None:
            continue
        s = str(it).strip()
        # Strip a leading bullet marker if the source already had one.
        for marker in ("- ", "* "):
            if s.startswith(marker):
                s = s[len(marker):].strip()
                break
        if s:
            out.append(s)
    return out


def _difficulty(bead: dict) -> str | None:
    """Pull a difficulty from `labels` like ['difficulty:medium']."""
    labels = bead.get("labels")
    if not isinstance(labels, (list, tuple)):
        return None
    for lab in labels:
        if isinstance(lab, str) and lab.startswith("difficulty:"):
            val = lab.split(":", 1)[1].strip()
            if val:
                return val
    return None


def _build_markdown(bead: dict) -> str | None:
    """Build the ticket.md body from the bead, or None if nothing meaningful."""
    if not isinstance(bead, dict):
        return None

    title = bead.get("title")
    title = str(title).strip() if title is not None else ""

    description = bead.get("description")
    description = str(description).strip() if description is not None else ""

    acceptance = bead.get("acceptance_criteria")
    if acceptance is None:
        acceptance = bead.get("acceptance")
    accept_lines = _as_lines(acceptance)

    design = bead.get("design")
    design = str(design).strip() if design is not None else ""
    notes = bead.get("notes")
    notes = str(notes).strip() if notes is not None else ""

    difficulty = _difficulty(bead)

    # Nothing to write at all → leave the filesystem untouched.
    if not (title or description or accept_lines or design or notes):
        return None

    parts: list[str] = []
    parts.append(f"# {title}" if title else "# Ticket")
    if difficulty:
        parts.append(f"## Difficulty: {difficulty}")
    if description:
        parts.append("## Goal\n\n" + description)
    if accept_lines:
        body = "\n".join(f"- {line}" for line in accept_lines)
        parts.append("## Acceptance Criteria\n\n" + body)

    verification_chunks = [c for c in (design, notes) if c]
    if verification_chunks:
        parts.append("## Verification\n\n" + "\n\n".join(verification_chunks))
    else:
        parts.append(
            "## Verification\n\n"
            "Run the harness checks (vitest server+client) and verify the "
            "acceptance criteria above."
        )

    return "\n\n".join(parts) + "\n"


def render_ticket_md(bead: dict, dest: Path, *, overwrite: bool = False) -> bool:
    """Render a ticket.md for `bead` at `dest`.

    Returns True iff this call wrote the file. Returns False when an existing
    file is left in place (`dest.exists() and not overwrite`), when there was
    nothing meaningful to write, or when any error prevented writing. Never
    raises on a malformed bead or a write hiccup — it's strictly best-effort.
    """
    try:
        dest = Path(dest)
        if dest.exists() and not overwrite:
            return False  # on-disk spec wins
        markdown = _build_markdown(bead)
        if not markdown:
            return False
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(markdown, encoding="utf-8")
        return True
    except Exception:
        return False


__all__ = ["render_ticket_md"]
