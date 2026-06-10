## Keep Gate Flash Visible During Unlock

The unlock effect prepares a fading/scaling flash for the gate mesh after removing that mesh from the scene, so the visible transition currently relies on the ring and particle burst. Keeping the gate mesh attached until its short flash expires would better match the intended "slab dissolves" feedback.

### Acceptance Criteria
- When a passage unlocks, the old gate mesh remains visible for its brief fade/scale effect and is disposed only after the effect duration completes.
