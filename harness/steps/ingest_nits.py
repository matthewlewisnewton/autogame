"""ingest_nits — port of run_ticket.sh:231-257."""
from __future__ import annotations

import re
from datetime import datetime
from pathlib import Path

from harness.telemetry.logging import log

_TASKS_MD_HEADING = "## Backlog — Housekeeping"
_NIT_DIR_NUM_RE = re.compile(r"^(\d{3})-.+")


def ingest_nits(nits_file: Path, *, ticket_name: str, workspace) -> None:
    nits_file = Path(nits_file)
    if not nits_file.exists() or nits_file.stat().st_size == 0:
        return

    root = Path(workspace.root)
    tickets_dir = root / "tickets"
    if not tickets_dir.is_dir():
        return

    max_num = 0
    for child in tickets_dir.iterdir():
        m = _NIT_DIR_NUM_RE.match(child.name)
        if m:
            try:
                n = int(m.group(1))
                if n > max_num:
                    max_num = n
            except ValueError:
                pass
    next_num = f"{max_num + 1:03d}"

    stripped = re.sub(r"^\d{3}-", "", ticket_name)
    slug = f"{next_num}-cleanup-{stripped}"
    new_dir = tickets_dir / slug
    new_dir.mkdir(parents=True, exist_ok=True)

    try:
        sha = workspace.head_short()
    except Exception:
        sha = "unknown"
    today = datetime.now().strftime("%F")
    body = (
        f"# Cleanup nits from {ticket_name}\n\n"
        f"> **Staleness note.** This follow-up ticket was written against commit\n"
        f"> `{sha}` ({today}). The codebase may have moved on since it was filed —\n"
        f"> before acting, re-check every file path and code reference below\n"
        f"> against the CURRENT code, and skip any nit that is already resolved.\n\n"
        f"Minor, non-blocking nits the reviewer noted while passing `{ticket_name}`.\n"
        f"None blocked acceptance — clean them up when convenient.\n\n"
        f"## Difficulty: easy\n\n"
        f"{nits_file.read_text()}"
    )
    (new_dir / "ticket.md").write_text(body)

    tasks_md = root / "TASKS.md"
    if tasks_md.exists():
        text = tasks_md.read_text()
        line = f"- [ ] [{slug}](tickets/{slug}/)\n"
        if _TASKS_MD_HEADING in text:
            lines = text.splitlines(keepends=True)
            out: list[str] = []
            inserted = False
            for ln in lines:
                out.append(ln)
                if not inserted and ln.startswith(_TASKS_MD_HEADING):
                    out.append(line)
                    inserted = True
            tasks_md.write_text("".join(out))
        else:
            with tasks_md.open("a", encoding="utf-8") as f:
                if not text.endswith("\n"):
                    f.write("\n")
                f.write(line)

    log(f"[nits] filed backlog ticket {slug} (written against {sha}) from the reviewer's notes")


__all__ = ["ingest_nits"]
