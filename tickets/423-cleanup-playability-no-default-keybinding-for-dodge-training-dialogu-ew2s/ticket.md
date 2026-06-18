# Cleanup nits from playability-no-default-keybinding-for-dodge-training-dialogu-ew2s

> **Staleness note.** This follow-up ticket was written against commit
> `a7a8534e` (2026-06-18). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `playability-no-default-keybinding-for-dodge-training-dialogu-ew2s`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Reserve Space when remapping key-item binding

`getReservedKeys()` excludes both `useKeyItem` and `dodge`, so Space (the default dodge key) is not blocked when a player remaps the generic key-item action. A player could bind key-item to Space while dodge also defaults to Space, creating ambiguous double-firing on one keypress.
### Acceptance Criteria
- `getReservedKeys()` (or the key-item capture handler) treats the currently resolved dodge binding — default Space included — as reserved when capturing a new key-item binding.
- Remapping dodge to a custom key removes only that key from the dodge side; Space becomes available for key-item only if dodge was moved off Space.
- Unit test: attempting to bind `useKeyItem` to Space while dodge is on Space shows the "Key already in use" toast and leaves settings unchanged.
