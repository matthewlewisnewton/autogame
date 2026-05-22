"""prompts.renderer + prompts.noise_filter tests. Doc §11.1 rows."""
from __future__ import annotations

from pathlib import Path

import pytest

from harness.prompts.noise_filter import filter_agent_feedback_noise
from harness.prompts.renderer import apply_substitutions, render_prompt


# ----------------------------------------------- renderer

class TestRenderer:
    def test_simple_substitution(self):
        out = apply_substitutions("Read __FILE__ and act.", {"FILE": "/tmp/x"})
        assert out == "Read /tmp/x and act."

    def test_multiple_substitutions(self):
        text = "TICKET=__T__\nFEEDBACK=__F__\nHANDOFF=__H__\n"
        out = apply_substitutions(text, {"T": "/a", "F": "/b", "H": "/c"})
        assert out == "TICKET=/a\nFEEDBACK=/b\nHANDOFF=/c\n"

    def test_unused_markers_pass_through(self):
        """Bash behavior: a marker the template has that isn't substituted
        stays in the output."""
        out = apply_substitutions("__USED__ vs __UNUSED__", {"USED": "X"})
        assert "__UNUSED__" in out

    def test_unused_substitution_silently_dropped(self):
        """Bash behavior: extra args don't error."""
        out = apply_substitutions("just text", {"NEVER_USED": "X"})
        assert out == "just text"

    def test_render_prompt_reads_file(self, tmp_path: Path):
        template = tmp_path / "template.md"
        template.write_text("Hello __NAME__!\n")
        assert render_prompt(template, NAME="world") == "Hello world!\n"

    def test_render_prompt_missing_file_raises(self):
        with pytest.raises(FileNotFoundError):
            render_prompt(Path("/nonexistent/template.md"), KEY="value")


# ----------------------------------------------- noise filter

class TestNoiseFilter:
    def test_yolo_mode_stripped(self):
        text = "YOLO mode is enabled.\nReal review content here.\n"
        out = filter_agent_feedback_noise(text)
        assert "YOLO mode" not in out
        assert "Real review content" in out

    def test_ripgrep_warning_stripped(self):
        text = "Ripgrep is not available.\nReview content.\n"
        out = filter_agent_feedback_noise(text)
        assert "Ripgrep" not in out
        assert "Review content" in out

    def test_attempt_failed_retrying_line_stripped(self):
        text = (
            "Attempt 3 failed: You have exhausted your capacity. Retrying after 1s.\n"
            "Actual review content.\n"
        )
        out = filter_agent_feedback_noise(text)
        assert "Attempt 3 failed" not in out
        assert "Actual review content" in out

    def test_terminal_capacity_line_stripped(self):
        text = "You have exhausted your capacity on this model.\nReview.\n"
        out = filter_agent_feedback_noise(text)
        assert "exhausted your capacity" not in out

    def test_quota_reset_line_stripped(self):
        text = "Some quota will reset after 1 hour.\nReview prose.\n"
        out = filter_agent_feedback_noise(text)
        assert "reset after" not in out
        assert "Review prose" in out

    def test_real_content_preserved(self):
        """No noise markers → no changes (modulo trailing newline)."""
        text = "Just normal review content here.\nMore lines.\n"
        assert filter_agent_feedback_noise(text).strip() == text.strip()

    def test_empty_in_empty_out(self):
        assert filter_agent_feedback_noise("") == ""

    def test_all_noise_returns_empty(self):
        text = (
            "YOLO mode is enabled.\n"
            "Ripgrep is not available.\n"
            "You have exhausted your capacity on this model.\n"
        )
        assert filter_agent_feedback_noise(text) == ""

    def test_triple_newlines_collapsed(self):
        text = "Line 1.\nYOLO mode is enabled.\nRipgrep is not available.\nLine 2.\n"
        out = filter_agent_feedback_noise(text)
        assert "\n\n\n" not in out

    def test_idempotent(self):
        text = "YOLO mode is enabled.\nReview content.\n"
        once = filter_agent_feedback_noise(text)
        twice = filter_agent_feedback_noise(once)
        assert once == twice
