#!/usr/bin/env bash
# Lint the harness shell scripts with shellcheck.
#
# Run it directly, or let the pre-commit hook (harness/githooks/pre-commit)
# run it automatically whenever a harness/*.sh file is staged.
#
#   harness/lint.sh
#
# Exit: 0 = clean   1 = findings   2 = shellcheck not installed
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")" || exit 2

# Git hooks (and other automation that doesn't inherit an interactive login
# shell's PATH — e.g. the Claude Code Bash tool) often lack ~/.local/bin
# where the shellcheck binary is commonly installed. Mirror lib.sh's PATH
# fixup so the hook can find it. Without this, the pre-commit hook reports
# the lint tool as missing even when its binary is right there in ~/.local.
case ":$PATH:" in *":$HOME/.local/bin:"*) ;; *) export PATH="$HOME/.local/bin:$PATH" ;; esac

if ! command -v shellcheck >/dev/null 2>&1; then
  echo "lint: shellcheck not installed." >&2
  echo "  install: apt-get install shellcheck" >&2
  echo "  or download the static binary into ~/.local/bin (on PATH)." >&2
  exit 2
fi

# --severity=warning catches the real bugs — SC2318 (the local-sibling
# antipattern that has bitten this harness twice), unbound variables, bad
# quoting/word-splitting — without failing the gate on purely stylistic notes.
if shellcheck --severity=warning -- ./*.sh; then
  echo "lint: harness shell scripts clean (shellcheck --severity=warning)"
  exit 0
fi
exit 1
