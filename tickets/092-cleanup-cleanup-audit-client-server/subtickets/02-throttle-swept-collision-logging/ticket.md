# Throttle swept-collision rejection logging

`console.debug` for swept-collision rejections in `game/server/index.js` (~line 1374) prevents warn-level spam but still emits one line per rejected move tick. Add per-socket throttling so repeated rejections emit at most one debug line per 500–1000 ms window, while first rejection after idle still logs immediately.

## Acceptance Criteria

- Repeated swept-collision rejections for the same socket emit at most one `console.debug` line per throttle interval (e.g., 500–1000 ms).
- The first rejection after a period of no rejections (idle) still logs immediately.
- Invalid move payloads (malformed `data`) remain `console.warn` — throttling applies only to the swept-collision `console.debug`.
- Throttle state is tracked per-socket (reset on disconnect).

## Technical Specs

- **File:** `game/server/index.js`
- Add a module-level `Map` (e.g., `sweptCollisionLogTimes`) keyed by `socket.id` storing the timestamp of the last logged swept-collision rejection.
- In the swept-collision rejection path (~line 1374), check `Date.now() - lastTime >= THROTTLE_MS` before calling `console.debug`; update the timestamp on each emission.
- Clear the socket's entry from the Map on `socket.on('disconnect')`.
- Use a throttle interval of 500–1000 ms (define as a constant near the top of the file or inline).
- No other changes. Do not touch test files or client code.

## Verification: code
