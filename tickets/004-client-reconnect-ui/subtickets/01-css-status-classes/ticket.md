# Add CSS Classes for Connection Status States

Add colored CSS classes so the `#status` element can visually reflect Connected, Disconnected, and Reconnecting states.

## Acceptance Criteria
- `#status` gains three CSS classes: `.connected`, `.disconnected`, `.reconnecting`
- `.connected` sets text color to green (`#4ade80`)
- `.disconnected` sets text color to red (`#f87171`)
- `.reconnecting` sets text color to yellow (`#facc15`)
- The classes are visible on the `#status` element when applied (verifiable in-browser)

## Technical Specs
- **File to modify**: `game/client/style.css`
- Append three class rules after the existing `#status` block:

  ```css
  #status.connected { color: #4ade80; }
  #status.disconnected { color: #f87171; }
  #status.reconnecting { color: #facc15; }
  ```

## Verification: code
