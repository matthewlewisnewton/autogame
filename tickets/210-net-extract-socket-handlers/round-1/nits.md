## Normalize Extracted Handler Indentation

Several extracted socket handler callbacks preserve the old inline indentation, so nested callback bodies in `game/server/socketHandlers/deck.js`, `trade.js`, and `run.js` are harder to scan than the surrounding code. This is non-blocking because behavior and tests are correct, but a formatting pass would make future handler edits less error-prone.

### Acceptance Criteria
- Callback bodies in the extracted socket handler modules are consistently indented with the surrounding server style, with no behavior changes.
