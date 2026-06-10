import { describe, it, expect } from 'vitest';
import {
	ENEMY_DEFS,
	enemyDefFor,
	getEnemyCardDrop,
	getEnemyMagicStoneDrop,
} from '../index.js';
import { ENEMY_CARD_DROPS, ENEMY_MS_DROPS } from '../config.js';
import { buildEnemyDisplayCatalog } from '../enemyDisplay.js';

const DEF = ENEMY_DEFS.citadel_sovereign;
const STAGE_BOSSES = [
	'arena_champion',
	'crucible_sovereign',
	'glacial_tyrant',
	'spire_warden',
	'magma_colossus',
	'cinder_warden',
	'permafrost_warden',
	'annex_overseer',
];

describe('citadel_sovereign enemy type', () => {
	it('registers display metadata in ENEMY_DEFS', () => {
		expect(DEF.name).toBe('Citadel Sovereign');
		expect(DEF.description.length).toBeGreaterThan(0);
		expect(DEF.surfacedStats.length).toBeGreaterThan(0);
		expect(DEF.surfacedStats).toContain('hp');
		expect(DEF.surfacedStats).toContain('attackDamage');
	});

	it('pins HP at the 420 defeat-window ceiling', () => {
		expect(DEF.hp).toBe(420);
	});

	it('outdamages arena_champion and crucible_sovereign', () => {
		expect(DEF.attackDamage).toBeGreaterThan(ENEMY_DEFS.arena_champion.attackDamage);
		expect(DEF.attackDamage).toBeGreaterThan(ENEMY_DEFS.crucible_sovereign.attackDamage);
		expect(ENEMY_DEFS.arena_champion.attackDamage).toBe(26);
		expect(ENEMY_DEFS.crucible_sovereign.attackDamage).toBe(24);
	});

	it('matches or exceeds arena_champion reach', () => {
		expect(DEF.attackRange).toBeGreaterThanOrEqual(ENEMY_DEFS.arena_champion.attackRange);
		expect(ENEMY_DEFS.arena_champion.attackRange).toBe(6.5);
	});

	it('is the hardest-hitting live stage boss by attackDamage', () => {
		for (const type of STAGE_BOSSES) {
			expect(DEF.attackDamage).toBeGreaterThan(ENEMY_DEFS[type].attackDamage);
		}
	});

	it('orders above glacial_tyrant on melee pressure stats', () => {
		const tyrant = ENEMY_DEFS.glacial_tyrant;
		expect(DEF.attackDamage).toBeGreaterThan(tyrant.attackDamage);
	});

	it('resolves via enemyDefFor and surfaces in the display catalog', () => {
		expect(() => enemyDefFor('citadel_sovereign')).not.toThrow();
		expect(enemyDefFor('citadel_sovereign')).toBe(DEF);

		const entry = buildEnemyDisplayCatalog().types.citadel_sovereign;
		expect(entry.name).toBe('Citadel Sovereign');
		expect(entry.description).toBe(DEF.description);
		expect(entry.surfacedStats).toEqual(DEF.surfacedStats);
	});

	it('has boss-tier loot drops at least as high as arena_champion', () => {
		expect(ENEMY_CARD_DROPS.citadel_sovereign).toBeDefined();
		expect(getEnemyCardDrop({ type: 'citadel_sovereign' })).toBe('dungeon_drake');
		expect(ENEMY_MS_DROPS.citadel_sovereign).toBeGreaterThanOrEqual(ENEMY_MS_DROPS.arena_champion);
		expect(getEnemyMagicStoneDrop({ type: 'citadel_sovereign' })).toBe(70);
	});
});
