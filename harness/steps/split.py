"""split — port of run_ticket.sh::split_ticket. Claude carves a stuck
ticket into smaller child tickets that replace it in the backlog."""
from __future__ import annotations

import re
import shutil
import subprocess
from pathlib import Path
from typing import TYPE_CHECKING

from harness.telemetry.logging import log
from harness.telemetry.progress import emit_progress_event

if TYPE_CHECKING:
    from harness.roles import Role


_SEPARATOR_RE = re.compile(r"^===NEXT TICKET===\s*$", re.MULTILINE)
_TICKET_NUM_RE = re.compile(r"^(\d{3})-.+")
_TITLE_RE = re.compile(r"^#+\s+(.+)$", re.MULTILINE)


def _slugify(title: str, *, max_len: int = 40) -> str:
    s = title.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = s.strip("-")[:max_len].rstrip("-")
    return s


def _next_ticket_num(tickets_root: Path) -> str:
    max_num = 0
    for child in tickets_root.iterdir():
        m = _TICKET_NUM_RE.match(child.name)
        if m:
            try:
                n = int(m.group(1))
                if n > max_num:
                    max_num = n
            except ValueError:
                pass
    return f"{max_num + 1:03d}"


def _replace_tasks_md_entry(tasks_md: Path, parent_name: str,
                            child_names: list[str]) -> None:
    if not tasks_md.exists():
        return
    lines = tasks_md.read_text().splitlines(keepends=True)
    out: list[str] = []
    parent_marker = f"- [ ] [{parent_name}]"
    replaced = False
    for line in lines:
        if line.startswith(parent_marker) and not replaced:
            for child in child_names:
                out.append(f"- [ ] [{child}](tickets/{child}/)\n")
            replaced = True
            continue
        out.append(line)
    tasks_md.write_text("".join(out))


def parse_split_chunks(split_text: str) -> list[str]:
    return [c for c in _SEPARATOR_RE.split(split_text) if c.strip()]


def split(role: "Role", *, workspace, ticket_name: str, ticket_file: Path,
          base_ref: str, ticket_dir: Path, split_dir: Path,
          telemetry=None) -> bool:
    """Run the split role. Returns True iff ≥ 2 child tickets were filed."""
    split_dir = Path(split_dir)
    split_dir.mkdir(parents=True, exist_ok=True)
    emit_progress_event("split_start", {"ticket": ticket_name})
    log(f"[split] claude restructuring {ticket_name} into smaller tickets...")

    split_out_md = split_dir / "split-out.md"
    # split role writes new tickets under tickets/; that needs to be safe.
    try:
        tickets_rel = (Path(workspace.root) / "tickets").resolve().relative_to(
            Path(workspace.root).resolve())
        extra_safe = [f"{tickets_rel}/**"]
    except (ValueError, AttributeError):
        extra_safe = ["tickets/**"]
    chain = role.execute(
        workspace=workspace,
        prompt_vars={
            "TICKET_FILE": str(ticket_file),
            "BASE_REF": base_ref,
            "SPLIT_OUT": str(split_out_md),
        },
        artifacts_dir=split_dir,
        telemetry=telemetry,
        extra_safe_paths=extra_safe,
    )
    if chain.accepted_by is None:
        log("[split] role exhausted without producing a usable split plan")
        return False
    if not split_out_md.exists() or split_out_md.stat().st_size == 0:
        log("[split] role produced no split plan (split-out.md empty)")
        return False

    root = Path(workspace.root)
    for args in (
        ["rm", "-r", "--quiet", "--ignore-unmatch", "game/"],
        ["checkout", base_ref, "--", "game/"],
        ["clean", "-fdq", "game/"],
    ):
        try:
            subprocess.run(["git", *args], cwd=str(root),
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                           check=False)
        except OSError:
            pass

    for path in ticket_dir.iterdir() if ticket_dir.is_dir() else []:
        # claude impl-review fix: Python pipeline writes per-round dirs as
        # `round-N`, not `review-round-N` (the bash naming). The cleanup
        # below needs to match both prefixes so stale `round-N/` dirs
        # don't linger after a split.
        if path.name.startswith(("round-", "review-round-", ".reviews")) or path.name in ("rescue", "rescue-review", "review-feedback.md"):
            subprocess.run(["chmod", "-R", "u+w", str(path)],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
            if path.is_dir():
                shutil.rmtree(path, ignore_errors=True)
            else:
                path.unlink(missing_ok=True)

    chunks = parse_split_chunks(split_out_md.read_text())
    tickets_root = root / "tickets"
    names: list[str] = []
    for chunk in chunks:
        title_match = _TITLE_RE.search(chunk)
        if not title_match:
            continue
        slug = _slugify(title_match.group(1).strip())
        if not slug:
            continue
        num = _next_ticket_num(tickets_root)
        full_slug = f"{num}-{slug}"
        new_dir = tickets_root / full_slug
        new_dir.mkdir(parents=True, exist_ok=True)
        (new_dir / "ticket.md").write_text(chunk)
        names.append(full_slug)

    if len(names) < 2:
        log(f"[split] claude did not produce 2+ usable tickets — no split filed")
        for nm in names:
            shutil.rmtree(tickets_root / nm, ignore_errors=True)
        return False

    tasks_md = root / "TASKS.md"
    _replace_tasks_md_entry(tasks_md, ticket_name, names)

    workspace.stage(["TASKS.md"] + [f"tickets/{nm}" for nm in names])
    commit_msg = (
        f"harness: split {ticket_name} into {len(names)} smaller tickets\n\n"
        f"{ticket_name} could not be completed in the configured remediation\n"
        f"rounds plus a claude rescue. Restructured into independently-\n"
        f"solvable tickets, which replace it in the backlog:\n"
        + "".join(f"  - {nm}\n" for nm in names)
        + "\nautogame"
    )
    try:
        workspace.commit(commit_msg)
    except Exception:
        log("[split] warning: commit of the split failed")

    log(f"[split] {ticket_name} -> {names}")
    emit_progress_event("ticket_split", {"ticket": ticket_name, "into": " ".join(names)})
    return True


__all__ = ["parse_split_chunks", "split"]
