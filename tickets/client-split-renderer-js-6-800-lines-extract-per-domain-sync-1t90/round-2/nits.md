## Clarify Generic Mesh Reconciler Scope
`syncMeshMap()` is currently applied to the simple spike-trap and ice-ball maps, while more complex domains keep custom reconcile loops because they manage parallel meshes, collection animations, or side effects. It would be worth either documenting those intentional exclusions near the helper or adding a follow-up helper variant for multi-map domains so future renderer work has a clearer pattern to follow.

### Acceptance Criteria
- The renderer sync modules clearly document when to use `syncMeshMap()` versus a custom loop, or equivalent helper coverage is added for another repeated simple reconcile site.
