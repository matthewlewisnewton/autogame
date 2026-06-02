## patchProfile JSDoc omits the cosmetic field
`game/client/settings.js`'s `patchProfile` now reads and returns a `cosmetic`
field (updating `cachedCosmetic`), but its `@param`/`@returns` JSDoc still only
documents `username`/`email`. Update the doc comment so the cosmetic round-trip
is discoverable.
### Acceptance Criteria
- `patchProfile`'s JSDoc documents that `fields` may include `cosmetic` and that
  the resolved value may carry `cosmetic`.

## Preview canvas size is hard-coded to 180px fallbacks
`game/client/cosmetic-preview.js` falls back to a literal `180` for width/height
when `clientWidth`/`clientHeight` are 0, duplicating the `width="180"
height="180"` attributes in `index.html`. If the canvas is ever restyled this
can silently desync.
### Acceptance Criteria
- The preview dimensions derive from a single source (canvas attributes or CSS)
  rather than a magic number repeated in JS and HTML, or the duplication is
  documented as intentional.
