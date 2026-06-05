## Auto-Discover Drift Guard Scan Targets

The drift guard currently uses an explicit production file list. It covers the current socket surfaces, but a future extracted handler or client module with socket calls must be manually added to stay protected.

### Acceptance Criteria
- The drift guard discovers or asserts all production server/client files containing socket `.emit`, `.on`, `.once`, or `.off` call sites are included in the scan, while continuing to exclude tests and lifecycle-only mocks.
