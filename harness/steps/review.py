"""Top-level review step + recover_review_files awk-extractor port.

Phase 3 lands recover_review_files (called by prompts.acceptance.ReviewAccept
when a writable reviewer in --mode ask falls back to chat-mode and prints
file contents instead of writing them).

Phase 4 lands the full review() pipeline step that invokes the review role
and orchestrates protect_review + the awk recovery path.

The bash recovery (lib.sh extract_file_block + recover_review_files in
run_ticket.sh) recognizes two transcript shapes:
  1. ``\\`review.md\\` content:`` marker followed by a fenced block.
  2. Markdown heading ``## review.md`` or ``## \\`review.md\\``` followed
     by a fenced block.
The first matching target-filename marker arms the extractor; the next
fenced block (delimited by lines starting with triple backticks) is
captured, language tag stripped, body written to disk.
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Optional

# Markers that arm the extractor for a given target filename. We match
# either: a line containing `<target>` in backticks, OR a markdown heading
# whose text (after stripping #, backticks, trailing colon) equals target.
_HEADING_RE = re.compile(r"^\s*#+\s+(.+)$")
_FENCE_RE = re.compile(r"^```(\w*)\s*$")


def extract_file_block(transcript: str, target_filename: str) -> Optional[str]:
    """Find the first fenced block following a marker that names target.
    Returns the block body (no fences, no language tag) or None.

    Ported from lib.sh::extract_file_block. The Python version is a
    state-machine line-by-line equivalent of the awk.
    """
    target_token = f"`{target_filename}`"
    lines = transcript.splitlines()
    armed = False
    in_fence = False
    captured: list[str] = []

    def is_marker(line: str) -> bool:
        if target_token in line:
            return True
        m = _HEADING_RE.match(line)
        if not m:
            return False
        heading = m.group(1).strip().replace("`", "").rstrip()
        if heading.endswith(":"):
            heading = heading[:-1].rstrip()
        return heading == target_filename

    for line in lines:
        if not armed:
            if is_marker(line):
                armed = True
            continue
        if not in_fence:
            # Allow arbitrary lines between marker and opening fence (some
            # transcripts emit a "content:" prefix line before the fence).
            if _FENCE_RE.match(line):
                in_fence = True
            continue
        # Inside fence — triple-backtick line ends capture.
        if _FENCE_RE.match(line):
            return ("\n".join(captured).rstrip() + "\n") if captured else ""
        captured.append(line)

    # Fence never closed → no match (bash returns empty; we return None to
    # distinguish from "marker armed, no body").
    return None


def recover_review_files(transcript: str, artifacts_dir: Path) -> dict[str, bool]:
    """Try to recover review.md / gaps.md / nits.md from a transcript that
    a chat-mode writable reviewer printed instead of writing.

    Returns {filename: True/False} for each target attempted; files that
    already exist on disk are NOT overwritten (bash semantics; safer for
    re-runs).
    """
    artifacts_dir = Path(artifacts_dir)
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    results: dict[str, bool] = {}
    for fname in ("review.md", "gaps.md", "nits.md"):
        target = artifacts_dir / fname
        if target.exists():
            continue
        body = extract_file_block(transcript, fname)
        if body is None:
            results[fname] = False
            continue
        target.write_text(body)
        results[fname] = True
    return results


__all__ = ["extract_file_block", "recover_review_files"]
