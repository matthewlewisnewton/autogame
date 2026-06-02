"""Migrate the open TASKS.md queue into beads (one-time, at cutover).

Parses the unchecked tickets in TASKS.md (in order), reads each `ticket.md` for
its `## Difficulty` (→ lane label), `## Depends on:` (→ dependency edges), and
`## Type: epic` (tracking-only → skipped, not a runnable bead). Creates one bead
per runnable ticket whose TITLE is the ticket dir name (so the dispatcher can map
a claimed bead back to `tickets/<name>/` and `harness worker <name>`), then adds
the dependency edges among created beads.

The dispatcher is the sole beads writer afterward; this runs once.
"""
from __future__ import annotations

import re
from pathlib import Path

from harness.beads import BeadsQueue
from harness.telemetry.logging import log

_UNCHECKED = re.compile(r"^- \[ \] \[([^\]]+)\]", re.MULTILINE)
_DIFFICULTY = re.compile(r"^\s*##?\s*Difficulty\s*:\s*(easy|medium|hard)\s*$",
                         re.MULTILINE | re.IGNORECASE)
_DEPENDS = re.compile(r"^\s*##?\s*Depends on\s*:\s*(.+?)\s*$",
                      re.MULTILINE | re.IGNORECASE)
_TYPE_EPIC = re.compile(r"^\s*##?\s*Type\s*:\s*epic", re.MULTILINE | re.IGNORECASE)


def open_ticket_names(tasks_md: Path) -> list[str]:
    p = Path(tasks_md)
    return _UNCHECKED.findall(p.read_text()) if p.exists() else []


def ticket_meta(ticket_md: Path) -> tuple[str, bool, list[str]]:
    """(difficulty, is_epic, depends_on[]) for a ticket.md."""
    text = ticket_md.read_text() if Path(ticket_md).exists() else ""
    md = _DIFFICULTY.search(text)
    difficulty = md.group(1).lower() if md else "medium"
    is_epic = bool(_TYPE_EPIC.search(text))
    deps: list[str] = []
    dm = _DEPENDS.search(text)
    if dm:
        raw = dm.group(1).strip()
        if raw.lower() not in ("none", "n/a", "-", ""):
            deps = [d.strip() for d in raw.split(",") if d.strip()]
    return difficulty, is_epic, deps


def _existing_titles(queue: BeadsQueue) -> set[str]:
    """Titles of beads already live (ready + in_progress) — for idempotency.
    Closed beads aren't included: their tickets are [x] in TASKS.md so
    open_ticket_names won't return them anyway."""
    titles: set[str] = set()
    try:
        for issue in queue.ready(limit=1000):
            if issue.get("title"):
                titles.add(issue["title"])
        for issue in queue.in_progress():
            if issue.get("title"):
                titles.add(issue["title"])
    except Exception as e:
        log(f"[migrate] could not list existing beads (assuming none): {e!r}")
    return titles


def migrate_open_tickets(repo_root, queue: BeadsQueue, *, tasks_md=None) -> dict[str, str]:
    """Create beads for every open, non-epic TASKS.md ticket + wire deps.
    Returns {ticket_name: bead_id}."""
    repo_root = Path(repo_root)
    tasks_md = Path(tasks_md) if tasks_md else repo_root / "TASKS.md"
    names = open_ticket_names(tasks_md)
    existing = _existing_titles(queue)

    metas: dict[str, tuple[str, bool, list[str]]] = {}
    created: dict[str, str] = {}
    # pass 1 — create runnable (non-epic) beads
    for name in names:
        ticket_md = repo_root / "tickets" / name / "ticket.md"
        if not ticket_md.exists():
            # Stale TASKS.md entry with no ticket dir — a bead here would be
            # unrunnable (the worker has no tickets/<name>/ to act on). Skip it.
            log(f"[migrate] skip {name}: no tickets/{name}/ticket.md")
            continue
        diff, is_epic, deps = ticket_meta(ticket_md)
        metas[name] = (diff, is_epic, deps)
        if is_epic:
            continue
        if name in existing:
            # Idempotent: a re-run must not create a duplicate bead (two workers
            # would then race the same auto/<name> branch).
            log(f"[migrate] skip {name}: bead already exists")
            continue
        created[name] = queue.create(name, difficulty=diff)
    # pass 2 — dependency edges (only among created beads; skip blockers that
    # are epics or already-closed/absent)
    for name, bead_id in created.items():
        _, _, deps = metas[name]
        for dep in deps:
            if dep in created:
                queue.add_dep(bead_id, created[dep])
    return created


__all__ = ["migrate_open_tickets", "open_ticket_names", "ticket_meta"]
