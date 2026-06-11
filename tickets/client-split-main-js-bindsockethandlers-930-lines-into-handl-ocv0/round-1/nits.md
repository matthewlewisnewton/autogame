## Reduce duplication between socketHandlerCtx state accessors and main.js

`createSocketHandlerCtx` declares a `STATE_ACCESSORS` array of ~31 keys and
defines a getter/setter for each against `deps.state`, while main.js separately
hand-writes a matching getter/setter pair for every one of those same keys into
the `state` object literal it passes in (game/client/main.js:1207-1270). This is
two parallel lists that must be kept in sync by hand; adding a new shared
state field means editing both spots, and a typo/omission silently yields an
`undefined` read with no error. Worth collapsing to a single source of truth.

### Acceptance Criteria
- Shared mutable-state keys are declared in exactly one place (no parallel
  getter/setter list duplicated between main.js and socketHandlerCtx.js).
- All existing main/socket vitest tests still pass with no behavior change.

## Document or shrink the ~180-entry context dependency bag

`createSocketHandlerCtx` accepts a single flat object of ~180 dependencies
(renderer effects, HUD updaters, UI helpers, constants) shared across all eight
handler modules. It follows the existing `cardRenderCtx` pattern, but the bag is
large enough that it is hard to tell which handler module actually needs which
dependency. Consider grouping by domain or at least adding a short comment block
delineating which cluster of deps belongs to which `bind*Handlers` consumer.

### Acceptance Criteria
- The context dependency surface is either grouped by consuming domain or
  annotated so a reader can map deps to the handler module that uses them.
- No behavior change; tests still pass.
