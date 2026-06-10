import { describe, it, expect, beforeEach } from 'vitest';
import {
	formatObjectiveSummary,
	formatRewardSummary,
	formatBriefingRewardLine,
	formatQuestTierLabel,
	findQuestBoardEntry,
	isQuestTierUnlocked,
	renderQuestBoard,
	renderQuestBriefing,
} from '../questBoard.js';

const SAMPLE_QUESTS = [
	{
		id: 'training_caverns',
		name: 'Initiate Vault',
		description: 'Purge hostiles from the derelict annex sector.',
		clientNpc: 'Annex Liaison Kade',
		briefing: 'Clear the annex sector and hold the vault mouth.',
		objectiveType: 'defeat_enemies',
		enemyCount: 5,
		rewardCurrency: 10,
		objectiveSummary: 'Neutralize 5 hostiles',
		rewardSummary: 'Reward: 10 money',
	},
	{
		id: 'crystal_rescue',
		name: 'Prism Salvage',
		description: 'Recover resonance prisms from the collapsed lattice.',
		objectiveType: 'collect_items',
		itemCount: 3,
		rewardCurrency: 12,
	},
	{
		id: 'last_stand',
		name: 'Last Stand',
		description: 'Hold the line against the incoming swarm.',
		objectiveType: 'survive',
		totalSpawns: 10,
		minibossCount: 2,
		rewardCurrency: 15,
	},
];

const TRAINING_TIER2_VARIANT = {
	questId: 'training_caverns',
	tier: 2,
	id: 'training_caverns',
	name: 'Initiate Vault — Tier II',
	description: 'Advanced clearance of the derelict annex sector.',
	objectiveType: 'defeat_enemies',
	objectiveSummary: 'Neutralize 5 hostiles',
	rewardSummary: 'Reward: 10 stones',
	isTier2: true,
};

describe('formatObjectiveSummary()', () => {
	it('summarizes defeat-enemies quests', () => {
		expect(formatObjectiveSummary(SAMPLE_QUESTS[0])).toBe('Neutralize 5 hostiles');
	});

	it('summarizes collect-items quests as metadata-only', () => {
		expect(formatObjectiveSummary(SAMPLE_QUESTS[1])).toBe(
			'Recover 3 prisms',
		);
	});

	it('summarizes survive quests with spawns and minibosses', () => {
		expect(formatObjectiveSummary(SAMPLE_QUESTS[2])).toBe(
			'Survive 10 hostiles (2 minibosses)',
		);
	});

	it('summarizes stage-boss quests with trial warden copy', () => {
		expect(
			formatObjectiveSummary({
				objectiveType: 'stage_boss',
				encounter: { addCount: 4 },
			}),
		).toBe('Defeat the trial warden and 4 supports');
		expect(
			formatObjectiveSummary({
				objectiveType: 'stage_boss',
				encounter: { addCount: 0 },
			}),
		).toBe('Defeat the trial warden');
	});

	it('summarizes stage-boss quests with annex overseer copy for vault encounters', () => {
		expect(
			formatObjectiveSummary({
				objectiveType: 'stage_boss',
				encounter: { bossType: 'annex_overseer', addCount: 4 },
			}),
		).toBe('Defeat the annex overseer and 4 supports');
		expect(
			formatObjectiveSummary({
				objectiveType: 'stage_boss',
				encounter: { bossType: 'annex_overseer', addCount: 0 },
			}),
		).toBe('Defeat the annex overseer');
	});

	it('summarizes spire_ascent stage-boss quests with summit warden copy', () => {
		expect(
			formatObjectiveSummary({
				id: 'spire_ascent',
				objectiveType: 'stage_boss',
				encounter: { addCount: 5 },
			}),
		).toBe('Defeat the summit warden and 5 supports');
		expect(
			formatObjectiveSummary({
				questId: 'spire_ascent',
				objectiveType: 'stage_boss',
				encounter: { addCount: 0 },
			}),
		).toBe('Defeat the summit warden');
	});

	it('summarizes canyon_descent stage-boss quests with canyon warden copy', () => {
		expect(
			formatObjectiveSummary({
				questId: 'canyon_descent',
				objectiveType: 'stage_boss',
				encounter: { addCount: 4 },
			}),
		).toBe('Defeat the canyon warden and 4 supports');
		expect(
			formatObjectiveSummary({
				questId: 'canyon_descent',
				objectiveType: 'stage_boss',
				encounter: { addCount: 0 },
			}),
		).toBe('Defeat the canyon warden');
	});
});

describe('formatRewardSummary()', () => {
	it('formats quest reward currency', () => {
		expect(formatRewardSummary(SAMPLE_QUESTS[0])).toBe('Reward: 10 money');
	});

	it('shows signature card name plus currency when rewardCardId is set', () => {
		expect(formatRewardSummary({
			rewardCardId: 'saber_of_light',
			rewardCurrency: 12,
		})).toBe('Reward: Saber of Light + 12 money');
	});

	it('appends the signature card name when present', () => {
		expect(
			formatRewardSummary({ rewardCurrency: 14, signatureCardName: 'Glacial Orb' }),
		).toBe('Reward: 14 money + Glacial Orb');
	});
});

describe('formatBriefingRewardLine()', () => {
	it('prefers briefingRewardText from the server payload', () => {
		expect(formatBriefingRewardLine({
			briefingRewardText: 'Reward: Signature blade',
			rewardCurrency: 10,
		})).toBe('Reward: Signature blade');
	});

	it('uses briefingRewardLine override when provided', () => {
		expect(formatBriefingRewardLine({
			briefingRewardLine: 'Reward: Named rare card',
			rewardCurrency: 10,
		})).toBe('Reward: Named rare card');
	});
});

describe('findQuestBoardEntry()', () => {
	it('resolves tier-1 quests from the quests list', () => {
		const entry = findQuestBoardEntry('training_caverns', 1, SAMPLE_QUESTS, []);
		expect(entry?.clientNpc).toBe('Annex Liaison Kade');
	});

	it('resolves tier-2 quests from quest variants', () => {
		const entry = findQuestBoardEntry('training_caverns', 2, SAMPLE_QUESTS, [TRAINING_TIER2_VARIANT]);
		expect(entry?.name).toContain('Tier II');
	});
});

describe('formatQuestTierLabel()', () => {
	it('appends (Tier 2) for tier-2 contracts', () => {
		expect(formatQuestTierLabel('Initiate Vault — Tier II', 2)).toBe('Initiate Vault (Tier 2)');
	});

	it('leaves tier-1 names unchanged', () => {
		expect(formatQuestTierLabel('Initiate Vault', 1)).toBe('Initiate Vault');
	});
});

describe('isQuestTierUnlocked()', () => {
	it('treats tier 1 as always unlocked', () => {
		expect(isQuestTierUnlocked({}, 'training_caverns', 1)).toBe(true);
	});

	it('checks persisted unlock map for tier 2', () => {
		const map = { training_caverns: [2] };
		expect(isQuestTierUnlocked(map, 'training_caverns', 2)).toBe(true);
		expect(isQuestTierUnlocked(map, 'training_caverns', 3)).toBe(false);
	});
});

describe('renderQuestBriefing()', () => {
	let container;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
	});

	it('renders NPC, briefing body, objective, and reward for the selected quest', () => {
		renderQuestBriefing(container, SAMPLE_QUESTS[0]);

		expect(container.classList.contains('hidden')).toBe(false);
		expect(container.querySelector('.quest-briefing-npc').textContent).toBe('Annex Liaison Kade');
		expect(container.querySelector('.quest-briefing-body').textContent).toContain('annex sector');
		expect(container.querySelector('.quest-briefing-objective').textContent).toBe('Neutralize 5 hostiles');
		expect(container.querySelector('.quest-briefing-reward').textContent).toBe('Reward: 10 money');
	});

	it('hides the panel when the quest has no briefing content', () => {
		renderQuestBriefing(container, { id: 'plain', description: 'No briefing' });
		expect(container.classList.contains('hidden')).toBe(true);
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
		expect(cards.length).toBe(3);
		expect(cards[1].classList.contains('selected')).toBe(true);
		expect(cards[1].querySelector('.quest-name').textContent).toBe('Prism Salvage');
		expect(cards[1].querySelector('.quest-objective').textContent).toContain('Recover 3 prisms');
		expect(cards[1].querySelector('.quest-reward').textContent).toBe('Reward: 12 money');
		expect(cards[2].querySelector('.quest-objective').textContent).toContain(
			'Survive 10 hostiles (2 minibosses)',
		);
	});

	it('renders the signature card reward next to currency when present', () => {
		const quests = [
			...SAMPLE_QUESTS,
			{
				id: 'frost_crossing',
				name: 'Frost Crossing',
				description: 'Cross the frozen cavern and purge hostiles from the ice field.',
				objectiveType: 'defeat_enemies',
				enemyCount: 6,
				rewardCurrency: 14,
				signatureCardId: 'ice_ball',
				signatureCardName: 'Glacial Orb',
			},
		];
		renderQuestBoard(container, quests, 'frost_crossing');

		const frostCard = container.querySelector('[data-quest-id="frost_crossing"]');
		expect(frostCard.querySelector('.quest-reward').textContent).toBe(
			'Reward: 14 money + Glacial Orb',
		);
		const trainingCard = container.querySelector('[data-quest-id="training_caverns"]');
		expect(trainingCard.querySelector('.quest-reward').textContent).toBe('Reward: 10 money');
	});

	it('invokes onSelectQuest when a card is clicked', () => {
		const selected = [];
		renderQuestBoard(container, SAMPLE_QUESTS, 'training_caverns', (questId, tier) => {
			selected.push({ questId, tier });
		});

		container.querySelector('[data-quest-id="crystal_rescue"]').click();
		expect(selected).toEqual([{ questId: 'crystal_rescue', tier: 1 }]);
	});

	it('updates selection without rebuilding cards when only selectedQuestId changes', () => {
		renderQuestBoard(container, SAMPLE_QUESTS, 'training_caverns');
		const firstCard = container.querySelector('[data-quest-id="training_caverns"]');

		renderQuestBoard(container, SAMPLE_QUESTS, 'crystal_rescue');

		expect(container.querySelector('[data-quest-id="training_caverns"]')).toBe(firstCard);
		expect(firstCard.classList.contains('selected')).toBe(false);
		expect(container.querySelector('[data-quest-id="crystal_rescue"]').classList.contains('selected')).toBe(true);
	});

	it('renders a locked Tier 2 row when not unlocked', () => {
		renderQuestBoard(container, SAMPLE_QUESTS, 'training_caverns', null, {
			questVariants: [TRAINING_TIER2_VARIANT],
			unlockedQuestTiers: {},
			selectedQuestTier: 1,
		});

		const tier2Card = container.querySelector('[data-quest-id="training_caverns"][data-quest-tier="2"]');
		expect(tier2Card).toBeTruthy();
		expect(tier2Card.classList.contains('quest-card-locked')).toBe(true);
		expect(tier2Card.disabled).toBe(true);
		expect(tier2Card.querySelector('.quest-tier-badge').textContent).toContain('Locked');
	});

	it('renders a clickable Tier 2 row when unlocked and passes tier on select', () => {
		const selected = [];
		renderQuestBoard(container, SAMPLE_QUESTS, 'training_caverns', (questId, tier) => {
			selected.push({ questId, tier });
		}, {
			questVariants: [TRAINING_TIER2_VARIANT],
			unlockedQuestTiers: { training_caverns: [2] },
			selectedQuestTier: 1,
		});

		const tier1Card = container.querySelector('[data-quest-id="training_caverns"][data-quest-tier="1"]');
		const tier2Card = container.querySelector('[data-quest-id="training_caverns"][data-quest-tier="2"]');
		expect(tier2Card.classList.contains('quest-card-locked')).toBe(false);
		expect(tier2Card.disabled).toBe(false);

		tier2Card.click();
		expect(selected).toEqual([{ questId: 'training_caverns', tier: 2 }]);

		renderQuestBoard(container, SAMPLE_QUESTS, 'training_caverns', null, {
			questVariants: [TRAINING_TIER2_VARIANT],
			unlockedQuestTiers: { training_caverns: [2] },
			selectedQuestTier: 2,
		});

		expect(tier1Card.classList.contains('selected')).toBe(false);
		expect(tier2Card.classList.contains('selected')).toBe(true);
	});
});
