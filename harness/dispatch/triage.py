"""Auto-triage — dispatcher-side safety net for stranded beads.

The dispatcher only claims work via `bd ready -l difficulty:<easy|medium|hard>`
(one query per lane). A bead with NO `difficulty:*` label matches no lane query
and is therefore NEVER worked — it strands silently. Creators set difficulty at
creation, but raw `bd create` / imports miss it (e.g. beads 162-179, 170-173 had
to be backfilled by hand).

`triage_uncategorized` is the safety net: it enumerates OPEN beads and labels any
that lack a `difficulty:<valid>` label with a lane (a `classify` hook's choice, or
a default). It runs INSIDE the dispatcher — the SOLE beads writer — so it never
contends on the single-writer Dolt lock. Idempotent: an already-labeled bead is
skipped, so it's safe to run every N ticks.
"""
from __future__ import annotations

from typing import Callable, Optional

from harness.beads import DIFFICULTY_LABEL
from harness.telemetry.logging import log


def _labels_of(bead: dict) -> list[str]:
    """Read a bead's labels defensively. `labels` is typically a list of strings,
    but may be absent (treat as none) or hold non-string entries (skip them)."""
    raw = bead.get("labels")
    if not raw:
        return []
    out: list[str] = []
    for item in raw:
        if isinstance(item, str):
            out.append(item)
        elif isinstance(item, dict):
            # tolerate {"name"/"label": "difficulty:easy"} shapes
            name = item.get("name") or item.get("label")
            if isinstance(name, str):
                out.append(name)
    return out


def _has_difficulty(bead: dict, valid) -> bool:
    wanted = {DIFFICULTY_LABEL.format(v) for v in valid}
    return any(lbl in wanted for lbl in _labels_of(bead))


def triage_uncategorized(queue, *, default_difficulty: str = "medium",
                         classify: Optional[Callable[[dict], Optional[str]]] = None,
                         valid=("easy", "medium", "hard")) -> list[tuple[str, str]]:
    """Label every OPEN bead that lacks a `difficulty:<valid>` label with a lane.

    Enumerates `queue.list_open()` (not just `ready` — so blocked-but-unlabeled
    beads like 170-173 also get a lane, not only ready ones). For each open bead
    with no `difficulty:<valid>` label: pick `classify(bead)` if it returns a valid
    lane, else `default_difficulty`, and apply it via
    `queue.add_label(id, DIFFICULTY_LABEL.format(diff))`.

    Skips epics/parents (issue_type == "epic") and anything already labeled.
    Defensive: a single bead's add_label failure is logged and skipped so it
    can't abort the whole pass. Idempotent. Returns [(id, diff)] for what it
    labeled this pass.
    """
    valid_set = set(valid)
    try:
        beads = queue.list_open()
    except Exception as e:
        log(f"[triage] list_open failed (skipping pass): {e!r}")
        return []

    labeled: list[tuple[str, str]] = []
    for bead in beads:
        try:
            bead_id = bead.get("id")
            if not bead_id:
                continue
            if bead.get("issue_type") == "epic":
                continue  # epics/parents aren't worked directly
            if _has_difficulty(bead, valid_set):
                continue  # already lane-labeled — idempotent

            diff = None
            if classify is not None:
                try:
                    cand = classify(bead)
                except Exception as e:
                    log(f"[triage] classify({bead_id}) raised: {e!r}")
                    cand = None
                if cand in valid_set:
                    diff = cand
            if diff is None:
                diff = default_difficulty

            try:
                queue.add_label(bead_id, DIFFICULTY_LABEL.format(diff))
            except Exception as e:
                log(f"[triage] add_label({bead_id}, {diff}) failed (skipping): {e!r}")
                continue
            labeled.append((bead_id, diff))
        except Exception as e:
            log(f"[triage] unexpected error on bead {bead!r} (skipping): {e!r}")
            continue

    if labeled:
        log(f"[triage] labeled {len(labeled)} stranded bead(s) with a difficulty lane: "
            + ", ".join(f"{i}->{d}" for i, d in labeled))
    return labeled


__all__ = ["triage_uncategorized"]
