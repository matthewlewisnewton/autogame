## Signal Familiar reuses `spawnMinionSummonInEffect` for a non-summon spell
`battle_familiar` is an instant radial-AoE spell that does not summon a persistent minion, yet its
cast flourish calls `spawnMinionSummonInEffect`. It reads fine on screen and is documented with a
comment, but the helper name implies a real minion summon and could mislead a future reader. A
small rename/alias (e.g. a generic `spawnSummonFlourish`) or an extra clarifying comment at the
call site would remove the ambiguity.
### Acceptance Criteria
- The cast flourish for `battle_familiar` no longer relies on a misleadingly-named helper, OR the
  call site carries a comment making clear no persistent minion is spawned.
- Existing Signal Familiar client tests still pass unchanged in behavior.
