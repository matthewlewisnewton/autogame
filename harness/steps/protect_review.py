"""protect_review + verify_reviews — port of run_ticket.sh:180-209."""
from __future__ import annotations

import filecmp
import shutil
from pathlib import Path

from harness.git_helpers import chmod_a_minus_w_recursive, chmod_u_plus_w
from harness.telemetry.logging import log


_PROTECTED_NAMES = ("review.md", "gaps.md", "nits.md")


def protect_review(*, label: str, working_dir: Path, archive_dir: Path) -> None:
    """Copy review.md/gaps.md/nits.md to archive_dir/<label>/ then chmod a-w."""
    working_dir = Path(working_dir)
    archive_dest = Path(archive_dir) / label
    archive_dest.mkdir(parents=True, exist_ok=True)
    for name in _PROTECTED_NAMES:
        src = working_dir / name
        if src.exists():
            shutil.copy2(src, archive_dest / name)
    chmod_a_minus_w_recursive(archive_dest)
    chmod_a_minus_w_recursive(working_dir)


def verify_reviews(reviews_dir: Path, ticket_dir: Path) -> None:
    """Integrity check + restore from archive.

    Handles two tamper modes:
      1. Live file modified vs archive → restore from archive.
      2. Live file DELETED — earlier version of this function skipped this
         case; gpt impl-review blocker. The bash equivalent restores in
         both cases. v5.1 hotfix: copy archive → live + reapply chmod a-w
         when live is missing.
    """
    reviews_dir = Path(reviews_dir)
    ticket_dir = Path(ticket_dir)
    if not reviews_dir.is_dir():
        return
    for label_dir in sorted(p for p in reviews_dir.iterdir() if p.is_dir()):
        label = label_dir.name
        live_dir = ticket_dir / label
        for name in _PROTECTED_NAMES:
            archived = label_dir / name
            live = live_dir / name
            if not archived.exists():
                continue
            # CASE 2: live missing — restore.
            if not live.exists():
                log(f"[integrity] {label}/{name} was DELETED after it was written — restoring from archive")
                live_dir.mkdir(parents=True, exist_ok=True)
                try:
                    shutil.copy2(archived, live)
                except OSError:
                    continue
                chmod_a_minus_w_recursive(live)
                continue
            # CASE 1: live differs from archive — restore.
            try:
                same = filecmp.cmp(str(archived), str(live), shallow=False)
            except OSError:
                continue
            if same:
                continue
            log(f"[integrity] {label}/{name} was modified after it was written — restoring from archive")
            chmod_u_plus_w(live)
            try:
                shutil.copy2(archived, live)
            except OSError:
                continue
            chmod_a_minus_w_recursive(live)


__all__ = ["protect_review", "verify_reviews"]
