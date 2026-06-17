#!/usr/bin/env bash
#
# Run every end-to-end scenario (server/e2e/*.e2e.cjs) against the real Postgres
# + Redis spun up by e2e-services.sh. Each scenario is a standalone Node script.
# Aggregates exit codes so a failure in any scenario fails the whole run.
set -u
cd "$(dirname "$0")/.." || exit 2

fail=0
shopt -s nullglob
files=(server/e2e/*.e2e.cjs)
if [ ${#files[@]} -eq 0 ]; then
	echo "no e2e scenarios found (server/e2e/*.e2e.cjs)" >&2
	exit 2
fi

for f in "${files[@]}"; do
	echo "── ${f} ──"
	node "$f" || fail=1
done

if [ "$fail" -ne 0 ]; then
	echo "E2E FAILED"
else
	echo "E2E PASSED"
fi
exit "$fail"
