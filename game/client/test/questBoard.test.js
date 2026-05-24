import { describe, it, expect, beforeEach } from 'vitest';
import {
	formatObjectiveSummary,
	formatRewardSummary,
	renderQuestBoard,
} from '../questBoard.js';

const SAMPLE_QUESTS = [
	{
		id: 'training_caverns',
		name: 'Initiate Vault',
		description: 'Purge hostiles from the derelict annex sector.',
		objectiveType: 'defeat_enemies',
		enemyCount: 5,
		rewardCurrency: 10,
	},
	{
		id: 'crystal_rescue',
		name: 'Prism Salvage',
		description: 'Recover resonance prisms from the collapsed lattice.',
		objectiveType: 'collect_items',
		itemCount: 3,
		rewardCurrency: 12,
	},
];

describe('formatObjectiveSummary()', () => {
	it('summarizes defeat-enemies quests', () => {
		expect(formatObjectiveSummary(SAMPLE_QUESTS[0])).toBe('Neutralize 5 hostiles');
	});

	it('summarizes collect-items quests as metadata-only', () => {
		expect(formatObjectiveSummary(SAMPLE_QUESTS[1])).toBe(
			'Recover 3 prisms',
		);
	});
});

describe('formatRewardSummary()', () => {
	it('formats quest reward currency', () => {
		expect(formatRewardSummary(SAMPLE_QUESTS[0])).toBe('Reward: 10 meseta');
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
		expect(cards[1].querySelector('.quest-name').textContent).toBe('Prism Salvage');
		expect(cards[1].querySelector('.quest-objective').textContent).toContain('Recover 3 prisms');
		expect(cards[1].querySelector('.quest-reward').textContent).toBe('Reward: 12 meseta');
	});

	it('invokes onSelectQuest when a card is clicked', () => {
		const selected = [];
		renderQuestBoard(container, SAMPLE_QUESTS, 'training_caverns', (questId) => {
			selected.push(questId);
		});

		container.querySelector('[data-quest-id="crystal_rescue"]').click();
		expect(selected).toEqual(['crystal_rescue']);
	});

	it('updates selection without rebuilding cards when only selectedQuestId changes', () => {
		renderQuestBoard(container, SAMPLE_QUESTS, 'training_caverns');
		const firstCard = container.querySelector('[data-quest-id="training_caverns"]');

		renderQuestBoard(container, SAMPLE_QUESTS, 'crystal_rescue');

		expect(container.querySelector('[data-quest-id="training_caverns"]')).toBe(firstCard);
		expect(firstCard.classList.contains('selected')).toBe(false);
		expect(container.querySelector('[data-quest-id="crystal_rescue"]').classList.contains('selected')).toBe(true);
	});
});
