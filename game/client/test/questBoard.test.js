import { describe, it, expect, beforeEach } from 'vitest';
import {
	formatObjectiveSummary,
	formatRewardSummary,
	renderQuestBoard,
} from '../questBoard.js';

const SAMPLE_QUESTS = [
	{
		id: 'training_caverns',
		name: 'Training Caverns',
		description: 'Clear a small dungeon of hostile creatures.',
		objectiveType: 'defeat_enemies',
		enemyCount: 5,
		rewardCurrency: 10,
	},
	{
		id: 'crystal_rescue',
		name: 'Crystal Rescue',
		description: 'Recover lost crystals from a guarded room.',
		objectiveType: 'collect_items',
		itemCount: 3,
		enemyCount: 4,
		rewardCurrency: 12,
	},
];

describe('formatObjectiveSummary()', () => {
	it('summarizes defeat-enemies quests', () => {
		expect(formatObjectiveSummary(SAMPLE_QUESTS[0])).toBe('Defeat 5 enemies');
	});

	it('summarizes collect-items quests as metadata-only', () => {
		expect(formatObjectiveSummary(SAMPLE_QUESTS[1])).toBe(
			'Collect 3 crystals (defeat 4 enemies for now)',
		);
	});
});

describe('formatRewardSummary()', () => {
	it('formats quest reward currency', () => {
		expect(formatRewardSummary(SAMPLE_QUESTS[0])).toBe('Reward: 10 gold');
	});
});

describe('renderQuestBoard()', () => {
	let container;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
	});

	it('renders quest cards and highlights the selected quest', () => {
		renderQuestBoard(container, SAMPLE_QUESTS, 'crystal_rescue');

		const cards = container.querySelectorAll('.quest-card');
		expect(cards.length).toBe(2);
		expect(cards[1].classList.contains('selected')).toBe(true);
		expect(cards[1].querySelector('.quest-name').textContent).toBe('Crystal Rescue');
		expect(cards[1].querySelector('.quest-objective').textContent).toContain('Collect 3 crystals');
		expect(cards[1].querySelector('.quest-reward').textContent).toBe('Reward: 12 gold');
	});

	it('invokes onSelectQuest when a card is clicked', () => {
		const selected = [];
		renderQuestBoard(container, SAMPLE_QUESTS, 'training_caverns', (questId) => {
			selected.push(questId);
		});

		container.querySelector('[data-quest-id="crystal_rescue"]').click();
		expect(selected).toEqual(['crystal_rescue']);
	});
});
