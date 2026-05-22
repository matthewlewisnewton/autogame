"""append_review_pointer + put_review_fb — port of run_ticket.sh:213-225."""
from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path
from typing import IO, Iterator

from harness.git_helpers import chmod_u_plus_w


@contextmanager
def put_review_fb(path: Path) -> Iterator[IO[str]]:
    """Open path in write mode after restoring its u+w bit (protect_review
    chmod a-w'd the prior round's files; we may need to overwrite)."""
    path = Path(path)
    chmod_u_plus_w(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    handle = path.open("w", encoding="utf-8")
    try:
        yield handle
    finally:
        handle.close()


def append_review_pointer(review_fb: Path, review_file: Path) -> None:
    review_fb = Path(review_fb)
    chmod_u_plus_w(review_fb)
    review_fb.parent.mkdir(parents=True, exist_ok=True)
    with review_fb.open("a", encoding="utf-8") as f:
        f.write(
            "\n---\n"
            "This is a compact summary distilled from the full review of the\n"
            "previous round. For per-criterion findings and the reasoning behind each\n"
            f"gap, read the full review at: {review_file}\n"
            "(That file is read-only — do not edit it.)\n"
        )


__all__ = ["append_review_pointer", "put_review_fb"]
