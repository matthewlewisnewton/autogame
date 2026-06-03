"""ticket_render — materialize a worker's ticket.md from a bead dict.

Pure filesystem; no beads/git. Verifies section rendering, on-disk precedence,
list-vs-string acceptance, defensive handling of missing fields, and that a
malformed bead never raises.
"""
from __future__ import annotations

from harness.dispatch.ticket_render import render_ticket_md


def test_full_bead_renders_all_sections(tmp_path):
    dest = tmp_path / "tickets" / "t1" / "ticket.md"
    bead = {
        "title": "Add smoke bomb item",
        "description": "Players can throw a smoke bomb to escape combat.",
        "acceptance_criteria": [
            "Item appears in inventory",
            "Throwing it applies a blind effect",
        ],
        "design": "Reuse the projectile system.",
        "notes": "Coordinate with the status-effect module.",
        "labels": ["difficulty:medium", "area:items"],
    }
    assert render_ticket_md(bead, dest) is True
    md = dest.read_text()
    assert md.startswith("# Add smoke bomb item")
    assert "## Difficulty: medium" in md
    assert "## Goal" in md
    assert "Players can throw a smoke bomb to escape combat." in md
    assert "## Acceptance Criteria" in md
    assert "- Item appears in inventory" in md
    assert "- Throwing it applies a blind effect" in md
    assert "## Verification" in md
    assert "Reuse the projectile system." in md
    assert "Coordinate with the status-effect module." in md


def test_existing_dest_not_overwritten_unless_flagged(tmp_path):
    dest = tmp_path / "tickets" / "t1" / "ticket.md"
    dest.parent.mkdir(parents=True)
    dest.write_text("HAND AUTHORED")
    bead = {"title": "Generated", "description": "from bead"}

    # overwrite=False (default) → leave the on-disk spec in place.
    assert render_ticket_md(bead, dest) is False
    assert dest.read_text() == "HAND AUTHORED"

    # overwrite=True → replace it.
    assert render_ticket_md(bead, dest, overwrite=True) is True
    assert dest.read_text() != "HAND AUTHORED"
    assert "# Generated" in dest.read_text()


def test_missing_optional_fields_skipped_without_error(tmp_path):
    dest = tmp_path / "tickets" / "t2" / "ticket.md"
    bead = {"title": "Minimal-ish", "description": "Only a goal here."}
    assert render_ticket_md(bead, dest) is True
    md = dest.read_text()
    assert "# Minimal-ish" in md
    assert "## Goal" in md
    assert "## Acceptance Criteria" not in md  # none provided → section skipped
    assert "## Difficulty:" not in md          # no difficulty label → skipped
    # Verification falls back to the default text when neither design nor notes.
    assert "## Verification" in md
    assert "Run the harness checks" in md


def test_acceptance_as_string_and_list_both_work(tmp_path):
    list_dest = tmp_path / "list" / "ticket.md"
    str_dest = tmp_path / "str" / "ticket.md"

    list_bead = {"title": "L", "acceptance": ["one", "two"]}
    assert render_ticket_md(list_bead, list_dest) is True
    list_md = list_dest.read_text()
    assert "- one" in list_md and "- two" in list_md

    str_bead = {"title": "S", "acceptance": "one\ntwo"}
    assert render_ticket_md(str_bead, str_dest) is True
    str_md = str_dest.read_text()
    assert "- one" in str_md and "- two" in str_md


def test_title_only_bead_still_writes_something(tmp_path):
    dest = tmp_path / "tickets" / "t3" / "ticket.md"
    assert render_ticket_md({"title": "Just a title"}, dest) is True
    md = dest.read_text()
    assert md.startswith("# Just a title")
    # Verification fallback gives the worker at least a default instruction.
    assert "## Verification" in md


def test_empty_or_malformed_bead_returns_false_without_raising(tmp_path):
    dest = tmp_path / "tickets" / "empty" / "ticket.md"
    # Empty dict → nothing meaningful → no file written.
    assert render_ticket_md({}, dest) is False
    assert not dest.exists()
    # A non-dict bead must not raise.
    assert render_ticket_md(None, tmp_path / "n" / "ticket.md") is False  # type: ignore[arg-type]
    assert render_ticket_md("nope", tmp_path / "s" / "ticket.md") is False  # type: ignore[arg-type]


def test_acceptance_strips_preexisting_bullet_markers(tmp_path):
    dest = tmp_path / "tickets" / "b" / "ticket.md"
    bead = {"title": "B", "acceptance_criteria": ["- already bulleted", "* star"]}
    assert render_ticket_md(bead, dest) is True
    md = dest.read_text()
    # No double bullets like "- - already bulleted".
    assert "- already bulleted" in md
    assert "- - already bulleted" not in md
    assert "- star" in md
