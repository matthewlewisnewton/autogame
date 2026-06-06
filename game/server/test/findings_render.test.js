import { describe, expect, it } from 'vitest';
import { renderFindings } from '../../../harness/validate/lib/findings.mjs';

const baseRun = {
	ok: true,
	assertions: {
		bossSpawned: true,
		encounterActivated: true,
		bossDefeated: true,
		victoryFired: true,
	},
};

describe('renderFindings', () => {
	it('uses annex_overseer and Rooms title for rooms preset', () => {
		const md = renderFindings({
			...baseRun,
			preset: 'rooms',
			bossType: 'annex_overseer',
		});
		expect(md).toContain('# Rooms validation findings');
		expect(md).toContain('**bossSpawned (annex_overseer)**: PASS');
		expect(md).not.toContain('spire_warden');
	});

	it('uses spire_warden and Spire Ascent title for spire-ascent preset', () => {
		const md = renderFindings({
			...baseRun,
			preset: 'spire-ascent',
			bossType: 'spire_warden',
		});
		expect(md).toContain('# Spire Ascent validation findings');
		expect(md).toContain('**bossSpawned (spire_warden)**: PASS');
		expect(md).not.toContain('annex_overseer');
	});

	it('requires bossType', () => {
		expect(() => renderFindings({ ...baseRun, preset: 'rooms' })).toThrow(/bossType/);
	});
});
