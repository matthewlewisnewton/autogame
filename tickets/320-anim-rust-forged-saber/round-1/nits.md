## Dead accent lookup for iron_sword in renderRustForgedSaber
`renderRustForgedSaber` computes `const color = getAccentHex('iron_sword') ?? style.color`,
but `iron_sword` has no entry in `CARD_ACCENT_STYLE` (game/client/cards.js), so
`getAccentHex` always returns `undefined` and the color always falls back to
`style.color`. The lookup is harmless but misleading — it implies an accent
source of truth that doesn't exist. Either add an `iron_sword` accent entry (so
the card icon/swing share one rust tone) or drop the lookup and use `style.color`
directly, matching how `emissive` is already read straight from the style.

### Acceptance Criteria
- `renderRustForgedSaber`'s color source is unambiguous: either `iron_sword`
  exists in `CARD_ACCENT_STYLE` and is used, or the `getAccentHex` call is
  removed in favor of `style.color`.
- The rust-steel swing color (0x78716c body) is unchanged in the rendered output.
- `cardRenderers.test.js` still passes.
