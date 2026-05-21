# Capture plan: use cardType instead of hard-coded slot references

The top-level ticket notes that `capture-plan-gemini.txt` still describes "slot 2 a monster" in step descriptions. The `summon-ready` deck deals vary (depending on deck order), and summon replacement shifts types across slots. Any card-related steps — especially those added by sub-ticket 01 — must refer to `cardType` (summon / monster / weapon) rather than hard-coded slot numbers. If the current capture plan has no slot references, this sub-ticket is a no-op (already resolved).

## Acceptance Criteria

- `capture-plan-gemini.txt` contains no step descriptions or probes that hard-code a slot index (e.g., "slot 2") to identify a card type.
- All card-related steps use `cardType` (summon / monster / weapon) or `data-card-type` attribute targeting.
- Slot numbers appear only where intentionally fixed (e.g., keyboard key bindings for movement).
- If the file already has no hard-coded slot references for cards, this sub-ticket passes as-is.

## Technical Specs

- **File:** `lobby.png/capture-plan-gemini.txt`
- Audit all step descriptions and probe descriptions for "slot N" references tied to card types.
- Replace with `cardType`-based targeting (e.g., `cardType: "monster"` instead of "slot 2 a monster").
- Verify no regression: the card steps added by sub-ticket 01 must also use `cardType`.

## Verification: code
