# Cleanup nits from 213-net-shared-event-name-constants

> **Staleness note.** This follow-up ticket was written against commit
> `e0c25de2` (2026-06-05). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `213-net-shared-event-name-constants`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Auto-Discover Drift Guard Scan Targets

The drift guard currently uses an explicit production file list. It covers the current socket surfaces, but a future extracted handler or client module with socket calls must be manually added to stay protected.

### Acceptance Criteria
- The drift guard discovers or asserts all production server/client files containing socket `.emit`, `.on`, `.once`, or `.off` call sites are included in the scan, while continuing to exclude tests and lifecycle-only mocks.
