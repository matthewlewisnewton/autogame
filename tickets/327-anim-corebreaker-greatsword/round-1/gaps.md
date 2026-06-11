1. Corebreaker Greatsword VFX range does not match the server-resolved effect range.
   Files: game/client/cardRenderers.js, game/client/test/cardRenderers.test.js, game/shared/cardStats.json
   Fix: Make `renderCorebreakerGreatsword` derive its cone/trail/impact range from the `cardUsed.attackRange` payload/card definition, or add the intended `attackRange: 7` to `magma_greatsword` shared stats so the server hit cone and fire_trail also resolve at 7; update tests to assert client VFX range equals the server/effective range.
