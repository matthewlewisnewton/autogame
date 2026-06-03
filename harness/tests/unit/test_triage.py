"""triage_uncategorized — dispatcher-side safety net that labels stranded beads.

Drives the pass with a minimal fake queue (list_open() + add_label() capturing
calls) — no real beads/Dolt.
"""
from __future__ import annotations

from harness.beads import DIFFICULTY_LABEL
from harness.dispatch.triage import triage_uncategorized


class FakeQueue:
    """Minimal beads stand-in: serves `open` beads and records add_label calls.
    `raise_on` ids make add_label blow up to exercise the defensive path."""

    def __init__(self, open_beads, *, raise_on=()):
        self._open = list(open_beads)
        self._raise_on = set(raise_on)
        self.labels: list[tuple[str, str]] = []  # (id, label) applied

    def list_open(self):
        return list(self._open)

    def add_label(self, issue_id, label):
        if issue_id in self._raise_on:
            raise RuntimeError(f"boom on {issue_id}")
        self.labels.append((issue_id, label))


def test_unlabeled_bead_gets_default_medium():
    q = FakeQueue([{"id": "b1", "labels": []}, {"id": "b2"}])  # labels absent on b2
    out = triage_uncategorized(q)
    assert sorted(out) == [("b1", "medium"), ("b2", "medium")]
    assert sorted(q.labels) == [("b1", DIFFICULTY_LABEL.format("medium")),
                                ("b2", DIFFICULTY_LABEL.format("medium"))]


def test_already_labeled_is_untouched():
    q = FakeQueue([
        {"id": "b1", "labels": [DIFFICULTY_LABEL.format("hard")]},
        {"id": "b2", "labels": ["something-else", DIFFICULTY_LABEL.format("easy")]},
    ])
    out = triage_uncategorized(q)
    assert out == []
    assert q.labels == []  # idempotent — nothing re-applied


def test_epics_are_skipped():
    q = FakeQueue([
        {"id": "epic1", "issue_type": "epic", "labels": []},
        {"id": "b1", "labels": []},
    ])
    out = triage_uncategorized(q)
    assert out == [("b1", "medium")]
    assert ("epic1", DIFFICULTY_LABEL.format("medium")) not in q.labels


def test_classify_hook_overrides_to_hard():
    q = FakeQueue([{"id": "b1", "labels": []}, {"id": "b2", "labels": []}])
    # classify returns hard for b1, an invalid value for b2 (falls back to default)
    def classify(bead):
        return "hard" if bead["id"] == "b1" else "trivial"
    out = triage_uncategorized(q, classify=classify)
    assert sorted(out) == [("b1", "hard"), ("b2", "medium")]
    assert sorted(q.labels) == [("b1", DIFFICULTY_LABEL.format("hard")),
                                ("b2", DIFFICULTY_LABEL.format("medium"))]


def test_add_label_failure_on_one_bead_does_not_stop_others():
    q = FakeQueue([{"id": "b1", "labels": []},
                   {"id": "bad", "labels": []},
                   {"id": "b2", "labels": []}],
                  raise_on=("bad",))
    out = triage_uncategorized(q)
    # the failing bead is skipped; the others still get labeled
    assert sorted(out) == [("b1", "medium"), ("b2", "medium")]
    assert ("bad", DIFFICULTY_LABEL.format("medium")) not in q.labels
    assert ("b1", DIFFICULTY_LABEL.format("medium")) in q.labels
    assert ("b2", DIFFICULTY_LABEL.format("medium")) in q.labels


def test_custom_default_difficulty():
    q = FakeQueue([{"id": "b1", "labels": []}])
    out = triage_uncategorized(q, default_difficulty="easy")
    assert out == [("b1", "easy")]
    assert q.labels == [("b1", DIFFICULTY_LABEL.format("easy"))]


def test_list_open_failure_returns_empty_without_raising():
    class Boom:
        def list_open(self):
            raise RuntimeError("dolt down")
    out = triage_uncategorized(Boom())
    assert out == []
