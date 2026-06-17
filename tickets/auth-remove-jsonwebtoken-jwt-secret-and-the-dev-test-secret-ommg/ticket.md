# Auth: remove jsonwebtoken + JWT_SECRET and the dev/test secret fallbacks (cleanup)

## Difficulty: hard

## Goal

Once HTTP, socket, and client auth all run on session cookies, remove the now-dead JWT machinery: drop the jsonwebtoken dependency from game/server/package.json; delete JWT issuance/verification (verifyToken, getJWTSecret, JWT_SECRET handling) from game/server/auth.js INCLUDING the insecure dev-secret/test-secret fallbacks (auth.js ~123/141 — the weak-default-secret footgun). Update the deploy env contract: remove JWT_SECRET from game/Dockerfile + game/fly.toml docs (sessions need no signing secret; if a cookie-signing secret is later added, document SESSION_SECRET instead). Remove any remaining references to the JWT path. Update tests.

## Acceptance Criteria

- jsonwebtoken removed from deps; no JWT issuance/verification or JWT_SECRET/dev-secret/test-secret code remains; Dockerfile/fly.toml env docs updated (no JWT_SECRET); full auth flow still works on sessions; tests pass; no dead JWT references.

## Verification

qwen failed (rc=-15)
reconcile: orphaned in_progress on dispatcher startup
