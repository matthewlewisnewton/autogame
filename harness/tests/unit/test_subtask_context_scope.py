"""Tests for CONTEXT.md scope detection in the subtask pipeline."""
from __future__ import annotations

from pathlib import Path

import pytest

from harness.pipelines.subtask import _detect_ticket_allows_context


class TestDetectTicketAllowsContext:
    def test_true_when_ticket_references_context_md(self, tmp_path: Path) -> None:
        ticket = tmp_path / "ticket.md"
        ticket.write_text(
            "# Update CONTEXT.md auth wording\n\n"
            "**File to change:** `CONTEXT.md` (repo root)\n"
        )
        assert _detect_ticket_allows_context(ticket) is True

    def test_false_when_ticket_does_not_reference_context_md(self, tmp_path: Path) -> None:
        ticket = tmp_path / "ticket.md"
        ticket.write_text(
            "# Add lobby feature\n\n"
            "Edit `game/server/index.js` only.\n"
        )
        assert _detect_ticket_allows_context(ticket) is False

    def test_false_when_ticket_file_missing(self, tmp_path: Path) -> None:
        assert _detect_ticket_allows_context(tmp_path / "missing.md") is False
