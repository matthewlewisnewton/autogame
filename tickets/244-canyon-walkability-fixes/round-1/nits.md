## Collapse Duplicate Shared Ramp Walls

Adjacent central sunken-canyon ramps that exactly touch can still each emit a side wall on the same shared X boundary. This does not recreate the original wedge because the walls are coincident rather than separated, but collapsing exact duplicates would make the geometry cleaner and align the code more closely with the "merged ramp" intent.

### Acceptance Criteria
- Shared ramp boundaries that have identical X/Z spans are represented by at most one wall collider or are intentionally opened as a contiguous ramp surface.
