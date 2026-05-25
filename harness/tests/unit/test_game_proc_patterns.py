"""Regression: harness must recognize vite/game-server cmdlines even when
the binary is invoked via a full path (e.g. via `npx` resolving to
`node_modules/.bin/vite`).

Bug discovered on ticket 055 supervisor run (2026-05-22): the original
regex required `(^|\\s)` before `vite`, but the live cmdline is
`node /…/.bin/vite --port 5173 --strictPort` — the slash failed the
boundary. Result: stop_game's pkill missed the proc, wait_port_free
decided "not harness owned, leaving it", and three start_game retries
each hit EADDRINUSE.
"""
from __future__ import annotations

import sys
from unittest.mock import MagicMock, patch

from harness.steps.game import (
    _is_harness_game_proc,
    _pid_cmdline,
    _port_holders,
)


class TestIsHarnessGameProc:
    def test_vite_via_npx_full_path(self):
        cmdline = ("node /home/matt/workspace/autogame/game/client/"
                   "node_modules/.bin/vite --port 5173 --strictPort")
        assert _is_harness_game_proc(cmdline)

    def test_vite_bare(self):
        assert _is_harness_game_proc("vite --port 5173 --strictPort")

    def test_vite_with_leading_npx(self):
        assert _is_harness_game_proc("npx vite --port 5173 --strictPort")

    def test_game_server_relative(self):
        assert _is_harness_game_proc("node game/server/index.js")

    def test_unrelated_node_proc_not_matched(self):
        assert not _is_harness_game_proc("node /home/matt/workspace/autogame/harness/progress/server.mjs")

    def test_wrong_port_not_matched(self):
        assert not _is_harness_game_proc("vite --port 3000")

    def test_port_prefix_not_matched(self):
        assert not _is_harness_game_proc("vite --port 51735")


class TestPortHolders:
    @patch("harness.steps.game._pid_cmdline", return_value="node game/server/index.js")
    @patch("harness.steps.game.subprocess.run")
    def test_darwin_uses_lsof(self, mock_run: MagicMock, _mock_cmdline: MagicMock) -> None:
        mock_run.return_value.stdout = "4242\n"
        with patch.object(sys, "platform", "darwin"):
            assert _port_holders(3000) == [(4242, "node game/server/index.js")]
        mock_run.assert_called_once_with(
            ["lsof", "-nP", "-iTCP:3000", "-sTCP:LISTEN", "-t"],
            capture_output=True,
            text=True,
            timeout=5,
        )

    @patch("harness.steps.game._pid_cmdline", return_value="vite --port 5173 --strictPort")
    @patch("harness.steps.game.subprocess.run")
    def test_linux_uses_ss(self, mock_run: MagicMock, _mock_cmdline: MagicMock) -> None:
        mock_run.return_value.stdout = "LISTEN 0 128 *:5173 users:((\"node\",pid=5150,fd=21))"
        with patch.object(sys, "platform", "linux"):
            assert _port_holders(5173) == [(5150, "vite --port 5173 --strictPort")]
        mock_run.assert_called_once_with(
            ["ss", "-tlnp", "sport = :5173"],
            capture_output=True,
            text=True,
            timeout=5,
        )


class TestPidCmdline:
    @patch("harness.steps.game.subprocess.run")
    def test_darwin_uses_ps(self, mock_run: MagicMock) -> None:
        mock_run.return_value.returncode = 0
        mock_run.return_value.stdout = "node game/server/index.js"
        with patch.object(sys, "platform", "darwin"):
            assert _pid_cmdline(4242) == "node game/server/index.js"
        mock_run.assert_called_once_with(
            ["ps", "-p", "4242", "-o", "args="],
            capture_output=True,
            text=True,
            timeout=5,
        )

    @patch("builtins.open", create=True)
    def test_linux_reads_proc(self, mock_open: MagicMock) -> None:
        mock_open.return_value.__enter__.return_value.read.return_value = (
            b"node\x00game/server/index.js"
        )
        with patch.object(sys, "platform", "linux"):
            assert _pid_cmdline(4242) == "node game/server/index.js"
