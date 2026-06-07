1. Review capture is `ok:false` (`failure_kind: "capture_failed"`): the harness
   ran its fallback telepipe suspend/resume plan (`capturePlanSource:"fallback"`,
   `scenarios:["telepipe-ready"]`) instead of this ticket's walkable-hub capture,
   and that plan tripped the stale `assertRunPreserved` ("pre-suspend enemy id(s)
   missing after resume ... suspended objective was not captured"). The game ran
   cleanly (pageerrors `[]`, servers up) and the hub deliverable
   (`game/validation/hub/`) is complete and green — this is a HARNESS blocker.
   Files: harness/screenshot.mjs (`assertRunPreserved`, ~lines 1116-1199 and the
   fallback plan builder); none in `game/`.
   Fix: drive the review capture with the hub-full plan, OR reconcile
   `assertRunPreserved` with current post-287 telepipe semantics — a fresh
   redeploy (new runId, regenerated dungeon, vitals preserved), matching the
   sibling `assertVitalsPreserved` which already requires `freshRunId`. Do NOT
   modify `game/` or `harness/validate/*`.
