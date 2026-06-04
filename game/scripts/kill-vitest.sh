#!/usr/bin/env bash
# Kill orphaned vitest worker processes for this repo's game/ test suite.
# Does not target scripts/run-vitest.mjs (the launcher) or unrelated "vitest" matches.
set -euo pipefail

GAME_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LAUNCHER_PID="${RUN_VITEST_LAUNCHER_PID:-}"
killed=0

is_vitest_worker_cmd() {
  local cmd="$1"
  case "$cmd" in
    *run-vitest.mjs*) return 1 ;;
    *node_modules/*/vitest*|*node_modules/.bin/vitest*) return 0 ;;
    *"node (vitest"*) return 0 ;;
    *vitest\ run\ *) return 0 ;;
    *) return 1 ;;
  esac
}

while read -r pid; do
  [ -z "$pid" ] && continue
  if [ -n "$LAUNCHER_PID" ] && [ "$pid" = "$LAUNCHER_PID" ]; then
    continue
  fi
  cmd="$(ps -p "$pid" -o args= 2>/dev/null || true)"
  [ -z "$cmd" ] && continue
  is_vitest_worker_cmd "$cmd" || continue
  cwd="$(lsof -a -d cwd -p "$pid" -Fn 2>/dev/null | sed -n 's/^n//p' | head -1 || true)"
  if [ "$cwd" = "$GAME_DIR" ]; then
    if kill -9 "$pid" 2>/dev/null; then
      killed=$((killed + 1))
    fi
  fi
done < <(pgrep -f 'node_modules/.*/vitest|node \(vitest|vitest run ' 2>/dev/null || true)

printf 'killed %s vitest process(es) for %s\n' "$killed" "$GAME_DIR"
