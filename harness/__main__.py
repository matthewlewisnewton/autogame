"""Entry point for `python -m harness <subcommand>`.

Run from the autogame repo root (parent of harness/):

    cd autogame
    python -m harness supervisor
    python -m harness backlog
    python -m harness ticket <name>
    python -m harness subtask <dir>
    python -m harness progress {start,stop,status}
    python -m harness doctor vision

Subcommand routing lives in harness.cli — see design doc §4.
"""

from harness.cli import main

if __name__ == "__main__":
    raise SystemExit(main())
