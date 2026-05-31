"""Regression tests for the harness game-process cmdline matcher.

Guards the EADDRINUSE infra failure where a leftover dev server launched with
cwd=game/ (cmdline `node server/index.js`, no `game/` prefix) was not
recognised as a harness-owned proc, so wait_port_free() refused to free :3000
and the freshly launched server crashed with
`listen EADDRINUSE: address already in use :::3000`.
"""
from harness.steps.game import _is_harness_game_proc


def test_server_cmdline_with_game_prefix_matches():
    # The form start_game itself launches (repo-root cwd).
    assert _is_harness_game_proc("node game/server/index.js")


def test_server_cmdline_without_game_prefix_matches():
    # The leftover form (cwd=game/) that previously slipped through and held
    # :3000, triggering EADDRINUSE on the next run.
    assert _is_harness_game_proc("node server/index.js")


def test_server_cmdline_absolute_path_matches():
    assert _is_harness_game_proc(
        "node /home/matt/workspace/autogame/game/server/index.js"
    )


def test_vite_cmdlines_match():
    assert _is_harness_game_proc(
        "node /repo/game/client/node_modules/.bin/../vite/bin/vite.js "
        "--port 5173 --strictPort"
    )
    assert _is_harness_game_proc("node .../.bin/vite --port 5173")


def test_unrelated_node_proc_does_not_match():
    # Must not start killing arbitrary node servers that merely live under a
    # path; only the game server / vite-on-5173 are harness-owned.
    assert not _is_harness_game_proc("node /srv/other-app/server.js")
    assert not _is_harness_game_proc("node some/other/indexer.js")
    assert not _is_harness_game_proc("vite --port 4173")
