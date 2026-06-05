# 258-miniboss-encounter-framework

## Difficulty: medium

## Goal

Generic boss-encounter system for Tier-2: designate a stage boss, trigger the fight, arena/encounter state, defeat -> reward/unlock hook. Reuses the per-player HP scaling from 270.

## Acceptance Criteria

- A reusable miniboss encounter: spawn designated boss, lock the encounter, defeat grants reward; per-player HP scaling. Tests.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
