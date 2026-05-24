"""Unit tests for vitest orphan cleanup helpers."""
from __future__ import annotations

import os
import signal
import subprocess
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from harness.steps.vitest_cleanup import (
    _kill_process_group,
    kill_vitest_for_cwd,
    run_vitest,
    vitest_process_cwd,
)


class TestVitestProcessCwd:
    @patch("harness.steps.vitest_cleanup.subprocess.run")
    def test_darwin_parses_lsof(self, mock_run: MagicMock) -> None:
        mock_run.return_value.stdout = "p123\nn/tmp/game\n"
        with patch.object(sys, "platform", "darwin"):
            assert vitest_process_cwd(123) == Path("/tmp/game")

    @patch("harness.steps.vitest_cleanup.os.readlink")
    def test_linux_reads_proc(self, mock_readlink: MagicMock) -> None:
        mock_readlink.return_value = "/srv/game"
        with patch.object(sys, "platform", "linux"):
            assert vitest_process_cwd(99) == Path("/srv/game")


class TestKillVitestForCwd:
    @patch("harness.steps.vitest_cleanup.vitest_process_cwd")
    @patch("harness.steps.vitest_cleanup.subprocess.run")
    @patch("harness.steps.vitest_cleanup.os.kill")
    def test_kills_matching_cwd_only(
        self,
        mock_kill: MagicMock,
        mock_run: MagicMock,
        mock_cwd: MagicMock,
    ) -> None:
        mock_run.return_value.stdout = "10\n20\n"
        mock_cwd.side_effect = lambda pid: Path("/game") if pid == 10 else Path("/other")

        killed = kill_vitest_for_cwd(Path("/game"))

        assert killed == 1
        mock_kill.assert_called_once_with(10, signal.SIGKILL)


class TestRunVitest:
    @patch("harness.steps.vitest_cleanup.kill_vitest_for_cwd")
    @patch("harness.steps.vitest_cleanup.subprocess.Popen")
    def test_kills_process_group_on_timeout(
        self,
        mock_popen: MagicMock,
        mock_cleanup: MagicMock,
        tmp_path: Path,
    ) -> None:
        proc = MagicMock()
        proc.pid = 555
        proc.poll.return_value = None
        proc.wait.return_value = 124
        mock_popen.return_value = proc

        with patch("harness.steps.vitest_cleanup._kill_process_group") as mock_killpg:
            with patch("harness.steps.vitest_cleanup.time.monotonic", side_effect=[0, 100]):
                rc = run_vitest(
                    ["run", "--project", "server"],
                    cwd=tmp_path,
                    timeout_s=5,
                    stdout=MagicMock(),
                )

        assert rc == 124
        mock_killpg.assert_called()
        mock_cleanup.assert_called_once_with(tmp_path.resolve())


class TestKillProcessGroup:
    @patch("harness.steps.vitest_cleanup.os.killpg")
    @patch("harness.steps.vitest_cleanup.os.getpgid", return_value=777)
    def test_sends_term_then_kill(self, _mock_pgid: MagicMock, mock_killpg: MagicMock) -> None:
        _kill_process_group(42)
        assert mock_killpg.call_count >= 1
        assert mock_killpg.call_args_list[0].args == (777, signal.SIGTERM)
