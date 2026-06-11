# lobby registry: abandoned lobbies are never cleaned up; ghost 'In run - 0 player(s)' entries accumulate

## Difficulty: medium

## Goal

Every lobby ever created stays in the Lobby Registry forever. After a QA session the registry showed 17 entries, all 'Waiting · 0 player(s)' or — worse — 'In run · 0 player(s) · ember descent' with a Drop In button (a run with zero players still presented as joinable). New players face a wall of dead channels and can join a ghost mid-run lobby. Repro: create a lobby, leave via 'Return to Registry', refresh the list — the empty lobby persists indefinitely; do this a few times to reproduce the clutter. Expected: empty lobbies are reaped after a TTL (or immediately when the last player leaves), and 'In run' lobbies with zero connected players are terminated or marked stale.

## Acceptance Criteria

- A lobby with zero connected players disappears from the registry within a bounded TTL (or immediately); no registry entry can show 'In run · 0 player(s)'; joining a reaped lobby id returns a clean error.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
