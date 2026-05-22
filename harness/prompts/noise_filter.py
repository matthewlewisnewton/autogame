"""filter_agent_feedback_noise — port of lib.sh:356-380.

Strips transient CLI chatter (YOLO mode banners, ripgrep-missing warnings,
quota-retry lines) from QA output BEFORE it's appended to feedback.md.
Without this filter, the next iteration's implementer prompt is polluted
with noise that has nothing to do with the actual review.

Patterns ported verbatim. Each pattern matches on the trimmed line; if any
pattern matches, the line is dropped. Triple-newlines collapse to double
(prevents large gaps after filtering).
"""
from __future__ import annotations

import re

# Anchored on line start (after trim). Mirrors the bash `^...` regexes.
_NOISY_PATTERNS = (
    re.compile(r"^YOLO mode is enabled\."),
    re.compile(r"^Ripgrep is not available\."),
    re.compile(
        r"^Attempt \d+ failed: .*?(exhausted your capacity|quota|rate limit|"
        r"resource has been exhausted|too many requests|429).*?Retrying after",
        re.IGNORECASE,
    ),
    re.compile(r"^You have exhausted your capacity on this model\.", re.IGNORECASE),
    re.compile(r"^.*quota will reset after .*$", re.IGNORECASE),
)

_TRIPLE_NEWLINE = re.compile(r"\n{3,}")


def filter_agent_feedback_noise(text: str) -> str:
    """Drop noisy lines + collapse triple-newlines + trim.

    Returns the filtered text WITH a trailing newline if non-empty;
    empty string if everything filtered out. Matches the bash semantics
    (which writes `${output}\\n` on non-empty, nothing on empty).
    """
    if not text:
        return ""
    lines = text.splitlines()
    kept = []
    for line in lines:
        stripped = line.strip()
        if any(p.search(stripped) for p in _NOISY_PATTERNS):
            continue
        kept.append(line)
    joined = "\n".join(kept)
    collapsed = _TRIPLE_NEWLINE.sub("\n\n", joined).strip()
    if not collapsed:
        return ""
    return collapsed + "\n"


__all__ = ["filter_agent_feedback_noise"]
