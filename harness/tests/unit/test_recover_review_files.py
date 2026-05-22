"""recover_review_files / extract_file_block tests. Doc §11.2 row
'Reviewer prints file contents in chat instead of writing files'."""
from __future__ import annotations

from pathlib import Path

from harness.steps.review import extract_file_block, recover_review_files


# ----------------------------------------------- extract_file_block

class TestExtractFileBlock:
    def test_inline_backtick_marker(self):
        text = (
            "Some preamble.\n"
            "`review.md` content:\n"
            "```markdown\n"
            "Body line 1\n"
            "Body line 2\n"
            "```\n"
            "Trailing text.\n"
        )
        body = extract_file_block(text, "review.md")
        assert body == "Body line 1\nBody line 2\n"

    def test_markdown_heading_marker(self):
        text = (
            "# Some heading\n"
            "## review.md\n"
            "\n"
            "```\n"
            "Review body.\n"
            "```\n"
        )
        body = extract_file_block(text, "review.md")
        assert body == "Review body.\n"

    def test_heading_with_backticks(self):
        text = (
            "## `gaps.md`\n"
            "```markdown\n"
            "Gap 1\n"
            "```\n"
        )
        body = extract_file_block(text, "gaps.md")
        assert body == "Gap 1\n"

    def test_heading_with_trailing_colon(self):
        text = (
            "## nits.md:\n"
            "```markdown\n"
            "Nit one.\n"
            "```\n"
        )
        body = extract_file_block(text, "nits.md")
        assert body == "Nit one.\n"

    def test_no_marker_returns_none(self):
        text = "Nothing matches here.\n```markdown\nbody\n```\n"
        assert extract_file_block(text, "review.md") is None

    def test_marker_but_no_fence(self):
        """Marker armed but no fenced block follows → None.
        (Bash returns empty; we return None to distinguish from empty body.)"""
        text = "`review.md` content:\nProse without a fence.\n"
        assert extract_file_block(text, "review.md") is None

    def test_multiple_files_in_one_transcript(self):
        text = (
            "## review.md\n"
            "```\n"
            "Review body.\n"
            "```\n"
            "\n"
            "## gaps.md\n"
            "```\n"
            "Gap A\nGap B\n"
            "```\n"
        )
        assert extract_file_block(text, "review.md") == "Review body.\n"
        assert extract_file_block(text, "gaps.md") == "Gap A\nGap B\n"


# ----------------------------------------------- recover_review_files

class TestRecoverReviewFiles:
    def test_writes_missing_files(self, tmp_path):
        transcript = (
            "## review.md\n```\nReview body.\n```\n"
            "## gaps.md\n```\nGap 1\n```\n"
            "## nits.md\n```\nNit 1\n```\n"
        )
        result = recover_review_files(transcript, tmp_path)
        assert result == {"review.md": True, "gaps.md": True, "nits.md": True}
        assert (tmp_path / "review.md").read_text() == "Review body.\n"
        assert (tmp_path / "gaps.md").read_text() == "Gap 1\n"
        assert (tmp_path / "nits.md").read_text() == "Nit 1\n"

    def test_does_not_overwrite_existing(self, tmp_path):
        """Bash semantics: never clobber an already-present file."""
        (tmp_path / "review.md").write_text("Original.\n")
        transcript = "## review.md\n```\nFrom transcript.\n```\n"
        result = recover_review_files(transcript, tmp_path)
        assert "review.md" not in result  # skipped (already exists)
        assert (tmp_path / "review.md").read_text() == "Original.\n"

    def test_partial_recovery_no_nits(self, tmp_path):
        """review.md + gaps.md in transcript, nits.md absent.
        Common case: reviewer noted no nits."""
        transcript = (
            "## review.md\n```\nReview.\n```\n"
            "## gaps.md\n```\nGap.\n```\n"
        )
        result = recover_review_files(transcript, tmp_path)
        assert result == {"review.md": True, "gaps.md": True, "nits.md": False}
        assert (tmp_path / "review.md").exists()
        assert (tmp_path / "gaps.md").exists()
        assert not (tmp_path / "nits.md").exists()

    def test_empty_transcript(self, tmp_path):
        result = recover_review_files("", tmp_path)
        assert result == {"review.md": False, "gaps.md": False, "nits.md": False}
        assert not (tmp_path / "review.md").exists()
