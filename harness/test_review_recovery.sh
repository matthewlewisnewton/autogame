#!/usr/bin/env bash
# Lightweight fixture tests for transcript-based review file recovery.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# shellcheck source=harness/lib.sh
source "$ROOT/harness/lib.sh"

qwen_calls=0
qwen_extract_review_files() {
  qwen_calls=$((qwen_calls + 1))
  echo "unexpected qwen extractor call for deterministic fixture" >&2
  return 99
}

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

assert_file_content() {
  local file="$1" expected="$2" actual
  [ -f "$file" ] || fail "missing expected file: $file"
  actual="$(cat "$file")"
  if [ "$actual" != "$expected" ]; then
    printf 'Expected %s:\n%s\n\nActual:\n%s\n' "$file" "$expected" "$actual" >&2
    exit 1
  fi
}

assert_missing() {
  local file="$1"
  [ ! -e "$file" ] || fail "expected file to stay absent: $file"
}

case_dir="$tmp/filename-marker"
mkdir -p "$case_dir"
cat > "$case_dir/transcript.txt" <<'EOF'
The reviewer could not write files directly, so it printed them.

`review.md` content:

```markdown
# Review
VERDICT: FAIL
```

`gaps.md` content:

```markdown
# Gaps
- Fix one
```

`nits.md` content:

```markdown
# Nits
- Polish one
```
EOF
recover_review_files "$case_dir/transcript.txt" "$case_dir"
assert_file_content "$case_dir/review.md" $'# Review\nVERDICT: FAIL'
assert_file_content "$case_dir/gaps.md" $'# Gaps\n- Fix one'
assert_file_content "$case_dir/nits.md" $'# Nits\n- Polish one'

case_dir="$tmp/markdown-heading"
mkdir -p "$case_dir"
cat > "$case_dir/transcript.txt" <<'EOF'
## review.md

```markdown
# Heading Review
VERDICT: FAIL
```

### gaps.md:

```markdown
# Heading Gaps
- Fix heading
```

#### nits.md

```markdown
# Heading Nits
- Polish heading
```
EOF
recover_review_files "$case_dir/transcript.txt" "$case_dir"
assert_file_content "$case_dir/review.md" $'# Heading Review\nVERDICT: FAIL'
assert_file_content "$case_dir/gaps.md" $'# Heading Gaps\n- Fix heading'
assert_file_content "$case_dir/nits.md" $'# Heading Nits\n- Polish heading'

case_dir="$tmp/review-only"
mkdir -p "$case_dir"
cat > "$case_dir/transcript.txt" <<'EOF'
The review passed with no blocking gaps or nits.

## `review.md`

```markdown
# Pass Review
No issues found.
VERDICT: PASS
```
EOF
recover_review_files "$case_dir/transcript.txt" "$case_dir"
assert_file_content "$case_dir/review.md" $'# Pass Review\nNo issues found.\nVERDICT: PASS'
assert_missing "$case_dir/gaps.md"
assert_missing "$case_dir/nits.md"

case_dir="$tmp/preserve-existing"
mkdir -p "$case_dir"
printf 'Existing review\n' > "$case_dir/review.md"
cat > "$case_dir/transcript.txt" <<'EOF'
`review.md` content:

```markdown
# Replacement review
VERDICT: FAIL
```
EOF
recover_review_files "$case_dir/transcript.txt" "$case_dir"
assert_file_content "$case_dir/review.md" 'Existing review'

[ "$qwen_calls" -eq 0 ] || fail "qwen extractor was called during deterministic fixtures"

qwen_extract_review_files() {
  qwen_calls=$((qwen_calls + 1))
  printf '# Model Review\nVERDICT: FAIL\n' > "$2/review.md"
  printf '# Replacement Gaps\n' > "$2/gaps.md"
  return 0
}

case_dir="$tmp/qwen-preserve"
mkdir -p "$case_dir"
printf '# Existing Gaps\n' > "$case_dir/gaps.md"
cat > "$case_dir/transcript.txt" <<'EOF'
This transcript has no fenced review file for deterministic recovery.
EOF
recover_review_files "$case_dir/transcript.txt" "$case_dir"
assert_file_content "$case_dir/review.md" $'# Model Review\nVERDICT: FAIL'
assert_file_content "$case_dir/gaps.md" '# Existing Gaps'

[ "$qwen_calls" -eq 1 ] || fail "expected one qwen fallback call, got $qwen_calls"
echo "review recovery tests passed"
