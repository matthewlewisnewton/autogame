"""AcceptanceCriterion — three concrete kinds, per design doc §6.1.

The chain in Role.execute calls `criterion.accepts(result, workspace,
artifacts_dir)` after each tier (after scope_audit has cleared). True
accepts and returns the chain; False rejects the tier and promotes to the
next fallback.

The three kinds:
  - VerdictAccept     — stdout has `^VERDICT: PASS|FAIL` (QA roles)
  - ReviewAccept      — review.md exists on disk AND has a verdict;
                        runs recover_review_files() first (top-level review)
  - OkRcAccept        — accepts on AgentResult.ok (implementer, committer,
                        decomposer, rescue/split — success measured by
                        the surrounding pipeline, not by stdout shape)
"""
from __future__ import annotations

import re
from abc import ABC, abstractmethod
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from harness.agents.base import AgentResult

# Same verdict regex as spawn.py's has_verdict — kept in sync. (Both live as
# named constants here; spawn.py imports a literal for the classify
# short-circuit because importing prompts.acceptance into agents.spawn would
# create a cycle through roles.py → AcceptanceCriterion.)
VERDICT_PATTERN = re.compile(r"^VERDICT:\s*(PASS|FAIL)\b", re.MULTILINE)
REVIEW_VERDICT_PATTERN = re.compile(
    r"^VERDICT:\s*(PASS|FAIL|APPROVE|REJECT)\b", re.MULTILINE
)


class AcceptanceCriterion(ABC):
    """Decides whether a tier's AgentResult constitutes successful completion."""

    kind: str  # set by each subclass; matches YAML acceptance.kind discriminator

    @abstractmethod
    def accepts(self, result: "AgentResult", workspace, artifacts_dir: Path) -> bool: ...


class VerdictAccept(AcceptanceCriterion):
    """Used by QA roles. Accepts when stdout contains a verdict line."""

    kind = "verdict"

    def __init__(self, pattern: str = VERDICT_PATTERN.pattern):
        self.pattern = re.compile(pattern, re.MULTILINE)

    def accepts(self, result, workspace, artifacts_dir):
        return bool(self.pattern.search(result.stdout or ""))


class ReviewAccept(AcceptanceCriterion):
    """Used by the top-level review role.

    Accepts when:
      1. review.md exists in artifacts_dir, AND
      2. review.md contains a verdict line (REVIEW_VERDICT_PATTERN).

    gaps.md and nits.md are OPTIONAL — gaps only written on FAIL, nits
    only when the reviewer notes any. v2/v3 of the design used
    FilesWrittenAccept(["review.md", "gaps.md", "nits.md"]) which would
    have failed every PASS-no-nits run.

    KNOWN TRAP (cursor --mode ask): a writable reviewer running under
    --mode ask falls back to printing file contents in chat. ReviewAccept
    runs `recover_review_files(result.stdout, artifacts_dir)` BEFORE the
    file-existence check, so the awk extractor's recovered review.md is
    accepted on the same tier rather than failing-over to the next
    fallback unnecessarily.
    """

    kind = "review"

    def __init__(self,
                 verdict_pattern: str = REVIEW_VERDICT_PATTERN.pattern,
                 review_filename: str = "review.md"):
        self.verdict_pattern = re.compile(verdict_pattern, re.MULTILINE)
        self.review_filename = review_filename

    def accepts(self, result, workspace, artifacts_dir):
        review_path = Path(artifacts_dir) / self.review_filename
        if not review_path.exists():
            # Chat-mode recovery before declaring tier failed.
            from harness.steps.review import recover_review_files
            recover_review_files(result.stdout or "", Path(artifacts_dir))
        if not review_path.exists():
            return False
        try:
            text = review_path.read_text()
        except OSError:
            return False
        return bool(self.verdict_pattern.search(text))


class OkRcAccept(AcceptanceCriterion):
    """Used by roles whose success is measured by the surrounding pipeline
    rather than by stdout shape (implementer, committer, decomposer,
    rescue, split). True iff AgentResult.ok."""

    kind = "ok_rc"

    def accepts(self, result, workspace, artifacts_dir):
        return result.ok


_KIND_REGISTRY: dict[str, type[AcceptanceCriterion]] = {
    "verdict": VerdictAccept,
    "review": ReviewAccept,
    "ok_rc": OkRcAccept,
}


def build_from_yaml(spec: dict | None) -> AcceptanceCriterion:
    """Construct an AcceptanceCriterion from a YAML row.

    Examples:
      None or {}                              → OkRcAccept()
      {kind: verdict}                         → VerdictAccept()
      {kind: verdict, pattern: '...'}         → VerdictAccept(pattern=...)
      {kind: review}                          → ReviewAccept()
      {kind: review, review_filename: ...}    → ReviewAccept(filename=...)
      {kind: ok_rc}                           → OkRcAccept()
    """
    if not spec:
        return OkRcAccept()
    spec = dict(spec)  # don't mutate caller
    kind = spec.pop("kind", "ok_rc")
    cls = _KIND_REGISTRY.get(kind)
    if cls is None:
        raise ValueError(f"Unknown acceptance kind: {kind!r}")
    return cls(**spec)


__all__ = [
    "AcceptanceCriterion",
    "OkRcAccept",
    "REVIEW_VERDICT_PATTERN",
    "ReviewAccept",
    "VERDICT_PATTERN",
    "VerdictAccept",
    "build_from_yaml",
]
