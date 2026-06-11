import { describe, it, expect } from 'vitest';
import { renderFindings } from '../../../harness/validate/lib/findings.mjs';

const baseRun = {
	ok: true,
	preset: 'open-plaza',
	assertions: {
		bossSpawned: true,
		encounterActivated: true,
		bossDefeated: true,
		victoryFired: true,
	},
};

describe('renderFindings preset copy', () => {
	it('uses open-plaza findingsTitle and bossSpawnLabel from the preset', () => {
		const md = renderFindings({
			...baseRun,
			findingsTitle: 'Open Plaza validation findings',
			bossSpawnLabel: 'arena_champion (Arena Champion)',
		});
		expect(md).toMatch(/^# Open Plaza validation findings/m);
		expect(md).toContain('**bossSpawned (arena_champion (Arena Champion))**: PASS');
		expect(md).not.toContain('Rooms validation findings');
		expect(md).not.toContain('annex_overseer');
	});

	it('keeps rooms title and boss label when passed from preset', () => {
		const md = renderFindings({
			...baseRun,
			preset: 'rooms',
			findingsTitle: 'Rooms validation findings',
			bossSpawnLabel: 'annex_overseer (Annex Overseer)',
		});
		expect(md).toMatch(/^# Rooms validation findings/m);
		expect(md).toContain('**bossSpawned (annex_overseer (Annex Overseer))**: PASS');
	});

	it('keeps sunken-canyon title and boss label when passed from preset', () => {
		const md = renderFindings({
			...baseRun,
			preset: 'sunken-canyon',
			findingsTitle: 'Sunken Canyon validation findings',
			bossSpawnLabel: 'miniboss (Canyon Warden)',
		});
		expect(md).toMatch(/^# Sunken Canyon validation findings/m);
		expect(md).toContain('**bossSpawned (miniboss (Canyon Warden))**: PASS');
	});

	it('falls back to formatted preset name and bossType when labels are absent', () => {
		const md = renderFindings({
			...baseRun,
			preset: 'open-plaza',
			bossType: 'arena_champion',
		});
		expect(md).toMatch(/^# Open Plaza validation findings/m);
		expect(md).toContain('**bossSpawned (arena_champion)**: PASS');
	});

	it('renders boss encounter UI and visual identity probe sections', () => {
		const md = renderFindings({
			...baseRun,
			preset: 'sunken-canyon',
			findingsTitle: 'Sunken Canyon validation findings',
			bossSpawnLabel: 'miniboss (Canyon Warden)',
			bossEncounterUi: {
				hudVisible: true,
				bossName: 'Canyon Warden',
				hpFillWidthPct: 100,
				encounterLocked: true,
				encounterPhase: 'active',
			},
			bossVisualIdentity: {
				bossType: 'miniboss',
				bossEnemyId: 'boss-1',
				nearestAddType: 'grunt',
				bossDistinctFromAdds: true,
				bossRenderScale: 2.2,
				addRenderScale: 1,
			},
		});
		expect(md).toContain('## Boss encounter UI');
		expect(md).toContain('**bossName**: Canyon Warden');
		expect(md).toContain('## Boss visual identity');
		expect(md).toContain('**bossDistinctFromAdds**: yes');
	});

	it('renders rooms boss encounter UI and visual identity assertions', () => {
		const md = renderFindings({
			...baseRun,
			preset: 'rooms',
			findingsTitle: 'Rooms validation findings',
			bossSpawnLabel: 'annex_overseer (Annex Overseer)',
			assertions: {
				...baseRun.assertions,
				bossEncounterUiVisible: true,
				bossDistinctFromAdds: true,
			},
			bossEncounterUi: {
				hudVisible: true,
				bossName: 'Annex Overseer',
				hpFillWidthPct: 100,
				encounterLocked: true,
				encounterPhase: 'active',
			},
			bossVisualIdentity: {
				bossType: 'annex_overseer',
				bossEnemyId: 'boss-1',
				nearestAddType: 'grunt',
				bossDistinctFromAdds: true,
				bossRenderScale: 2.4,
				addRenderScale: 1,
			},
		});
		expect(md).toContain('**bossEncounterUiVisible**: PASS');
		expect(md).toContain('**bossDistinctFromAdds**: PASS');
		expect(md).toContain('## Boss encounter UI');
		expect(md).toContain('**bossName**: Annex Overseer');
		expect(md).toContain('## Boss visual identity');
		expect(md).toContain('**bossType**: annex_overseer');
	});

	it('renders rooms new-content exercise sections and assertions', () => {
		const md = renderFindings({
			...baseRun,
			preset: 'rooms',
			findingsTitle: 'Rooms validation findings',
			bossSpawnLabel: 'annex_overseer (Annex Overseer)',
			assertions: {
				...baseRun.assertions,
				bossEncounterUiVisible: true,
				bossDistinctFromAdds: true,
				slowBurnMutuallyExclusive: true,
				healCleanseApplied: true,
				windupTelegraphActive: true,
				telepipeVitalsPreserved: true,
				cardChargesResetOnNewSortie: true,
			},
			cardExercises: {
				slowBurn: { slowBurnMutuallyExclusive: true, targetEnemyId: 'grunt-1' },
				purifyingPulse: { healCleanseApplied: true, preCast: { hp: 40 }, postCast: { hp: 80 } },
				windup: { windupTelegraphActive: true, cardId: 'magma_greatsword' },
			},
			roomsTelepipe: {
				telepipeVitalsPreserved: true,
				cardChargesResetOnNewSortie: true,
				preSuspend: { hp: 100, magicStones: 3, runId: 'a' },
				postDeploy: { hp: 100, magicStones: 3, runId: 'b' },
			},
			screenshots: [
				'game/validation/rooms/08-slow-burn-mutual-exclusive.png',
				'game/validation/rooms/12-telepipe-after.png',
			],
		});
		expect(md).toContain('**slowBurnMutuallyExclusive**: PASS');
		expect(md).toContain('**cardChargesResetOnNewSortie**: PASS');
		expect(md).toContain('## Slow / burn mutual exclusivity');
		expect(md).toContain('## Heal / cleanse (Purifying Pulse)');
		expect(md).toContain('## Wind-up telegraph');
		expect(md).toContain('## Telepipe vitals and new-sortie charges');
		expect(md).toContain('## New content exercise');
		expect(md).toContain('08-slow-burn-mutual-exclusive.png');
	});

	it('renders sunken-canyon new-content exercise sections and assertions', () => {
		const md = renderFindings({
			...baseRun,
			preset: 'sunken-canyon',
			findingsTitle: 'Sunken Canyon validation findings',
			assertions: {
				...baseRun.assertions,
				bossEncounterUiVisible: true,
				bossDistinctFromAdds: true,
				slowBurnMutuallyExclusive: true,
				healCleanseApplied: true,
				windupTelegraphActive: true,
				telepipeVitalsPreserved: true,
				cardChargesResetOnNewSortie: true,
			},
			cardExercises: {
				slowBurn: { slowBurnMutuallyExclusive: true, targetEnemyId: 'grunt-1' },
				purifyingPulse: { healCleanseApplied: true, preCast: { hp: 40 }, postCast: { hp: 80 } },
				windup: { windupTelegraphActive: true, cardId: 'magma_greatsword' },
			},
			canyonTelepipe: {
				telepipeVitalsPreserved: true,
				cardChargesResetOnNewSortie: true,
				preSuspend: { hp: 100, magicStones: 3, runId: 'a' },
				postDeploy: { hp: 100, magicStones: 3, runId: 'b' },
			},
			screenshots: [
				'game/validation/sunken-canyon/08-slow-burn-mutual-exclusive.png',
				'game/validation/sunken-canyon/12-telepipe-after.png',
			],
		});
		expect(md).toContain('**bossEncounterUiVisible**: PASS');
		expect(md).toContain('**cardChargesResetOnNewSortie**: PASS');
		expect(md).toContain('## Slow / burn mutual exclusivity');
		expect(md).toContain('## Heal / cleanse (Purifying Pulse)');
		expect(md).toContain('## Wind-up telegraph');
		expect(md).toContain('## Telepipe vitals and new-sortie charges');
		expect(md).toContain('## New content exercise');
		expect(md).toContain('08-slow-burn-mutual-exclusive.png');
	});

	it('flags missing boss HUD in findings', () => {
		const md = renderFindings({
			...baseRun,
			bossEncounterUi: {
				hudVisible: false,
				bossName: '',
				hpFillWidthPct: null,
				encounterLocked: false,
				encounterPhase: 'dormant',
			},
			bossVisualIdentity: {
				bossType: 'miniboss',
				bossEnemyId: 'boss-1',
				nearestAddType: 'miniboss',
				bossDistinctFromAdds: false,
			},
		});
		expect(md).toContain('boss encounter HUD missing or hidden');
		expect(md).toContain('boss display name is empty');
		expect(md).toContain('not clearly distinct from the nearest live add');
	});
});
