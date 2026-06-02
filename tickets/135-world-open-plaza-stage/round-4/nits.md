## Update Open-Plaza Generator Comment

`generateOpenPlaza()` still has a doc comment saying the plaza output is identical for any seed because the empty plaza is fixed. The implementation now uses the seed for deterministic cover placement, so the comment should be updated to avoid misleading future work.

### Acceptance Criteria
- The `generateOpenPlaza()` comment accurately states that the base arena is fixed while cover placement varies deterministically by seed.
