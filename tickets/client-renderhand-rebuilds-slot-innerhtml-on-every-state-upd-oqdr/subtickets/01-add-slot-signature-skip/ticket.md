# 01 — Add per-slot signature and skip DOM writes when unchanged

## Description

Replace the unconditional `innerHTML` rebuild in `renderHand()` with a per-slot signature comparison. Compute a cheap signature string per slot (card id + charges + affordability + structural flags), cache it on the slot element, and skip the full DOM rebuild when the signature matches. The `--charge-pct` CSS custom property still updates every tick so burning-creature meters continue to animate.

## Acceptance Criteria

- `renderHand()` computes a per-slot signature from `card.id`, `card.remainingCharges`, `card.charges`, `card.activeMinionId`, `card.isEvolved`, `card.isDesperation`, `card.isEcho`, `card.grind`, `card.specialEffect`, and affordability (`no-ms`)
- When a slot's signature matches its cached value, `renderHand()` skips `innerHTML` assignment and class toggling for that slot (but still updates `--charge-pct`)
- When a slot's signature differs (card changed, charges changed, affordability flipped, slot became empty/filled), `renderHand()` performs the full DOM rebuild and stores the new signature
- `--charge-pct` CSS variable is updated every call for slots with an active card (so burning creatures still animate)
- All existing `renderHand()` tests in `game/client/test/main.test.js` continue to pass

## Technical Specs

- **File**: `game/client/main.js`
- Add a helper `slotSignature(card, playerMs)` returning a deterministic string (e.g., `${card.id}|${card.remainingCharges}|${card.charges}|${card.activeMinionId ?? ''}|${card.isEvolved}|${card.isDesperation}|${card.isEcho}|${card.grind}|${card.specialEffect ?? ''}|${affordable}`)
- Store cached signature on each slot element: `slot.dataset._sig = sig`
- In the per-slot loop of `renderHand()`, compare `slot.dataset._sig` against the fresh signature before doing any DOM writes
- Always update `slot.style.setProperty('--charge-pct', ...)` even on skip
- For empty slots, use a sentinel signature like `__empty__`

## Verification: code
