#!/usr/bin/env bash
# Kill orphaned vitest worker processes for this repo's game/ test suite.
set -euo pipefail

GAME_DIR="$(cd "$(dirname "$0")/.." && pwd)"
killed=0

while read -r pid; do
  [ -z "$pid" ] && continue
  cwd="$(lsof -a -d cwd -p "$pid" -Fn 2>/dev/null | sed -n 's/^n//p' | head -1 || true)"
  if [ "$cwd" = "$GAME_DIR" ]; then
    if kill -9 "$pid" 2>/dev/null; then
      killed=$((killed + 1))
    fi
  fi
done < <(pgrep -f vitest 2>/dev/null || true)

printf 'killed %s vitest process(es) for %s\n' "$killed" "$GAME_DIR"
