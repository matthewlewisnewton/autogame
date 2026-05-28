import { describe, it, expect } from 'vitest';
import { CARD_DEFS, getForgeAttunePreview } from '../cards.js';

describe('getForgeAttunePreview()', () => {
	it('builds attune stat preview rows', () => {
		const rows = getForgeAttunePreview(CARD_DEFS.battle_familiar, 1);
		expect(rows.some((row) => row.label === 'Attune' && row.current === '+1' && row.next === '+2')).toBe(true);
		expect(rows.some((row) => row.label === 'Damage' && row.current === '46' && row.next === '48')).toBe(true);
	});
});
