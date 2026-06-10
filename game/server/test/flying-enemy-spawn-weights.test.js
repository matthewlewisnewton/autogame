import { describe, it, expect } from 'vitest';
import { QUEST_DEFS } from '../quests.js';

// Each flier is wired into exactly one thematically-appropriate pool at a rare
// weight. void_seraph belongs to the high/airy levels; rime_drifter to the ice
// level. See sub-ticket 03 (rare/sparse flying-enemy spawn weights).
const FLIER_POOL_WIRING = [
	{ questId: 'spire_ascent', flier: 'void_seraph' },
	{ questId: 'canyon_descent', flier: 'void_seraph' },
	{ questId: 'frost_crossing', flier: 'rime_drifter' },
];

const FLIER_TYPES = ['void_seraph', 'rime_drifter'];

describe('flying-enemy rare spawn weights', () => {
	for (const { questId, flier } of FLIER_POOL_WIRING) {
		it(`adds ${flier} to ${questId} at weight 1`, () => {
			const pool = QUEST_DEFS[questId].enemyPool;
			const entry = pool.find(e => e.type === flier);
			expect(entry).toBeDefined();
			expect(entry.weight).toBe(1);
		});

		it(`keeps ${flier} at the lowest weight in the ${questId} pool`, () => {
			const pool = QUEST_DEFS[questId].enemyPool;
			const entry = pool.find(e => e.type === flier);
			const minWeight = Math.min(...pool.map(e => e.weight));
			// The flier must be (tied for) the rarest entry: no non-flier entry may
			// have a strictly lower weight, keeping fliers sparse.
			expect(entry.weight).toBe(minWeight);
		});
	}

	it('only wires fliers into the three thematic pools (no other pool gains a flier)', () => {
		const allowed = new Set(FLIER_POOL_WIRING.map(w => w.questId));
		for (const [questId, def] of Object.entries(QUEST_DEFS)) {
			if (allowed.has(questId)) continue;
			const pools = [
				...(def.enemyPool || []),
				...(def.tier2EnemyPool || []),
			];
			for (const flier of FLIER_TYPES) {
				expect(pools.some(e => e.type === flier)).toBe(false);
			}
		}
	});

	it('does not add fliers to tier2EnemyPool of the wired quests', () => {
		for (const { questId, flier } of FLIER_POOL_WIRING) {
			const tier2 = QUEST_DEFS[questId].tier2EnemyPool || [];
			expect(tier2.some(e => e.type === flier)).toBe(false);
		}
	});
});
