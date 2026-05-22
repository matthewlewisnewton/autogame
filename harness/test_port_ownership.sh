#!/usr/bin/env bash
# Lightweight fixture tests for harness-owned port cleanup helpers.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# shellcheck source=harness/lib.sh
source "$ROOT/harness/lib.sh"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

assert_harness_game() {
  local cmdline="$1" port="$2"
  cmdline_is_harness_game "$cmdline" "$port" || fail "expected harness game: port=$port cmdline=$cmdline"
}

assert_not_harness_game() {
  local cmdline="$1" port="$2"
  if cmdline_is_harness_game "$cmdline" "$port"; then
    fail "expected non-harness: port=$port cmdline=$cmdline"
  fi
}

# Harness vite / server command lines are recognized.
assert_harness_game 'node game/server/index.js' 3000
assert_harness_game '/usr/bin/node game/server/index.js' 3000
assert_harness_game 'node game/server/index.js --debug' 3000
assert_harness_game 'vite --port 5173 --strictPort' 5173
assert_harness_game 'npx vite --port 5173 --strictPort' 5173

# Unrelated local dev servers must not match.
assert_not_harness_game 'node other-app/server.js' 3000
assert_not_harness_game 'vite --port 3000' 5173
assert_not_harness_game 'node game/server/index.js' 5173
assert_not_harness_game 'python -m http.server 5173' 5173
assert_not_harness_game 'qwen -y implement ticket' 3000

# Tracked PIDs count as harness-owned even when cmdline is unknown.
GAME_PIDS=(4242)
pid_is_tracked_game 4242 || fail 'tracked pid should match'
if pid_is_tracked_game 9999; then fail 'untracked pid should not match'; fi
# shellcheck disable=SC2034
GAME_PIDS=()

# cleanup_port must not invoke broad fuser unless explicitly enabled.
fuser_calls=0
fuser() {
  fuser_calls=$((fuser_calls + 1))
  return 0
}
export -f fuser
HARNESS_BROAD_PORT_KILL=0
cleanup_port 5173
cleanup_port 3000
[ "$fuser_calls" -eq 0 ] || fail "fuser called without HARNESS_BROAD_PORT_KILL ($fuser_calls times)"

HARNESS_BROAD_PORT_KILL=1
cleanup_port 5173
[ "$fuser_calls" -ge 1 ] || fail 'expected fuser when HARNESS_BROAD_PORT_KILL=1'
# shellcheck disable=SC2034
HARNESS_BROAD_PORT_KILL=0

echo "port ownership tests passed"
