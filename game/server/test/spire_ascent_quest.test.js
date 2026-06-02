import { describe, it, expect } from 'vitest';
import { getLayoutProfileForQuest, getQuest } from '../quests.js';
import { generateLayout, questLayoutSeed } from '../dungeon.js';

describe('spire_ascent quest layout', () => {
	it('registers defeat objective with spire-ascent layout profile', () => {
		const quest = getQuest('spire_ascent');
		expect(quest).toBeTruthy();
		expect(quest.layoutProfile).toBe('spire-ascent');
		expect(quest.objectiveType).toBe('defeat_enemies');
		expect(quest.enemyCount).toBe(6);
	});

	it('getLayoutProfileForQuest returns spire-ascent', () => {
		expect(getLayoutProfileForQuest('spire_ascent')).toBe('spire-ascent');
	});

	it('applyLayoutForQuest pipeline uses spire-ascent with multi-tier rooms', () => {
		const questId = 'spire_ascent';
		const profile = getLayoutProfileForQuest(questId);
		const seed = questLayoutSeed(questId);
		const layout = generateLayout(seed, profile, { slopes: true });
		expect(layout.profile).toBe('spire-ascent');
		expect(layout.profile).not.toBe('crowded');
		const tierRooms = layout.rooms.filter(r => r.band === 'tier');
		expect(tierRooms.length).toBeGreaterThanOrEqual(3);
		expect(tierRooms.length).toBeLessThanOrEqual(5);
	});
});
