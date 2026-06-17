# Playthrough driver hardcodes PERSISTENCE_BACKEND=memory — can't validate against Postgres/real infra

## Difficulty: easy

## Goal

harness/validate/lib/gameProcess.mjs (~line 129) hardcodes PERSISTENCE_BACKEND: 'memory' in the server child env, overriding any value the caller exports. So the Playwright playthrough driver (harness/validate/playthrough.mjs) ALWAYS runs the server on the in-memory provider and can never exercise the real Postgres (or file) persistence path — making real-infra playthrough validation impossible via the standard driver (the QA had to launch the server manually instead). FIX: make the backend configurable — when PERSISTENCE_BACKEND / DATABASE_URL / REDIS_URL are present in the environment, pass them through to the server child; fall back to 'memory' only when unset, preserving today's fast/isolated default for the existing validation presets. Backward-compatible: presets that don't set the env still get memory.

## Acceptance Criteria

- When PERSISTENCE_BACKEND/DATABASE_URL/REDIS_URL are exported, the playthrough-started server uses them (server log shows PostgresProvider + real redis); when unset, it defaults to the in-memory provider exactly as today; existing playthrough presets unaffected.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
