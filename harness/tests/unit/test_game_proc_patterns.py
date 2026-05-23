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

from harness.steps.game import _is_harness_game_proc


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
