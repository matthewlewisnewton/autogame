"""Unit tests for the load-bearing steps that have non-trivial logic:
ingest_nits, protect_review/verify_reviews, split parser, port_holders filter.

Doc §11.1 / §11.2 coverage rows.
"""
from __future__ import annotations

import os
import re
import stat
import subprocess
from pathlib import Path

import pytest

from harness.steps.append_review import append_review_pointer, put_review_fb
from harness.steps.ingest_nits import ingest_nits
from harness.steps.protect_review import protect_review, verify_reviews
from harness.steps.split import parse_split_chunks
from harness.workspace.repo import Repo


def _init_repo(tmp_path: Path) -> Repo:
    subprocess.run(["git", "init", "-q"], cwd=tmp_path, check=True)
    subprocess.run(["git", "config", "user.email", "t@e"], cwd=tmp_path, check=True)
    subprocess.run(["git", "config", "user.name", "T"], cwd=tmp_path, check=True)
    (tmp_path / "TASKS.md").write_text("# Tasks\n\n## Backlog — Housekeeping\n")
    (tmp_path / "tickets").mkdir()
    (tmp_path / "tickets" / "001-existing").mkdir()
    (tmp_path / "tickets" / "001-existing" / "ticket.md").write_text("# existing\n")
    subprocess.run(["git", "add", "."], cwd=tmp_path, check=True)
    subprocess.run(["git", "commit", "-q", "-m", "init"], cwd=tmp_path, check=True)
    return Repo(root=tmp_path)


# ----------------------------------------------- ingest_nits

class TestIngestNits:
    def test_creates_new_ticket_and_tasks_md_entry(self, tmp_path):
        repo = _init_repo(tmp_path)
        nits = tmp_path / "nits.md"
        nits.write_text("- Nit 1\n- Nit 2\n")
        ingest_nits(nits, ticket_name="042-make-thing", workspace=repo)
        # New ticket dir created with the next number (002).
        new_dirs = sorted(p for p in (tmp_path / "tickets").iterdir() if p.name.startswith("002-"))
        assert len(new_dirs) == 1
        ticket_md = new_dirs[0] / "ticket.md"
        assert ticket_md.exists()
        body = ticket_md.read_text()
        assert "Cleanup nits from 042-make-thing" in body
        assert "Difficulty: easy" in body
        assert "Nit 1" in body
        # TASKS.md got the entry under "Backlog — Housekeeping".
        tasks = (tmp_path / "TASKS.md").read_text()
        assert f"- [ ] [{new_dirs[0].name}](tickets/{new_dirs[0].name}/)" in tasks

    def test_empty_nits_no_op(self, tmp_path):
        repo = _init_repo(tmp_path)
        nits = tmp_path / "nits.md"
        nits.write_text("")
        ingest_nits(nits, ticket_name="042-foo", workspace=repo)
        # No new ticket dirs.
        assert not any(p.name.startswith("002-") for p in (tmp_path / "tickets").iterdir())

    def test_missing_nits_no_op(self, tmp_path):
        repo = _init_repo(tmp_path)
        ingest_nits(tmp_path / "nonexistent.md", ticket_name="042-foo", workspace=repo)


# ----------------------------------------------- protect_review + verify_reviews

class TestProtectReview:
    def test_chmod_a_minus_w(self, tmp_path):
        working = tmp_path / "round-1"
        working.mkdir()
        (working / "review.md").write_text("review body\nVERDICT: PASS\n")
        archive = tmp_path / ".reviews"
        protect_review(label="round-1", working_dir=working, archive_dir=archive)
        # Both copies exist.
        assert (archive / "round-1" / "review.md").exists()
        assert (working / "review.md").exists()
        # Both write bits stripped (u+g+o have no write).
        for f in (archive / "round-1" / "review.md", working / "review.md"):
            mode = f.stat().st_mode
            assert not (mode & stat.S_IWUSR)
            assert not (mode & stat.S_IWGRP)
            assert not (mode & stat.S_IWOTH)

    def test_verify_restores_tampered(self, tmp_path):
        working = tmp_path / "round-1"
        working.mkdir()
        original = "review body\nVERDICT: PASS\n"
        (working / "review.md").write_text(original)
        archive = tmp_path / ".reviews"
        protect_review(label="round-1", working_dir=working, archive_dir=archive)
        # Tamper: restore u+w then overwrite.
        live = working / "review.md"
        os.chmod(live, live.stat().st_mode | stat.S_IWUSR)
        live.write_text("tampered with\n")
        # Verify should restore from archive.
        verify_reviews(archive, tmp_path)
        assert live.read_text() == original


# ----------------------------------------------- put_review_fb chmod dance

class TestPutReviewFb:
    def test_write_through_chmod_a_minus_w(self, tmp_path):
        fb = tmp_path / "review-feedback.md"
        fb.write_text("old content\n")
        # Simulate the protect_review side effect — mode 444.
        os.chmod(fb, 0o444)
        # put_review_fb must restore u+w first.
        with put_review_fb(fb) as f:
            f.write("new content\n")
        assert fb.read_text() == "new content\n"

    def test_append_pointer_works_on_readonly(self, tmp_path):
        fb = tmp_path / "review-feedback.md"
        fb.write_text("# Gaps\n")
        os.chmod(fb, 0o444)
        review_file = tmp_path / "review.md"
        review_file.write_text("...")
        append_review_pointer(fb, review_file)
        text = fb.read_text()
        assert "compact summary" in text
        assert str(review_file) in text


# ----------------------------------------------- split parser

class TestParseSplitChunks:
    def test_single_chunk(self):
        text = "# Ticket A\n\nDo a thing.\n"
        assert parse_split_chunks(text) == ["# Ticket A\n\nDo a thing.\n"]

    def test_three_chunks(self):
        text = (
            "# Ticket A\nbody A\n"
            "===NEXT TICKET===\n"
            "# Ticket B\nbody B\n"
            "===NEXT TICKET===\n"
            "# Ticket C\nbody C\n"
        )
        chunks = parse_split_chunks(text)
        assert len(chunks) == 3
        assert "Ticket A" in chunks[0]
        assert "Ticket B" in chunks[1]
        assert "Ticket C" in chunks[2]

    def test_zero_chunks(self):
        assert parse_split_chunks("") == []
        assert parse_split_chunks("   \n  \n") == []

    def test_chunk_with_no_header(self):
        """parser doesn't reject — split() at call site does (no title → skipped)."""
        chunks = parse_split_chunks("body only, no header\n===NEXT TICKET===\n# Real Header\nbody\n")
        assert len(chunks) == 2  # both pass through; split() filters later
