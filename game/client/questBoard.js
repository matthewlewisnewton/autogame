/**
 * Lobby quest board helpers — pure functions for rendering quest selection UI.
 */

import { THEME } from './theme.js';

export function formatObjectiveSummary(quest) {
	if (!quest) return '';

	if (quest.objectiveType === 'collect_items') {
		const itemCount = quest.itemCount ?? 0;
		return THEME.objectives.recoverPrisms.replace('{count}', String(itemCount));
	}

	if (quest.objectiveType === 'defeat_enemies') {
		const enemyCount = quest.enemyCount ?? 0;
		return THEME.objectives.neutralizeHostiles.replace('{count}', String(enemyCount));
	}

	if (quest.objectiveType === 'survive') {
		const totalSpawns = quest.totalSpawns ?? 0;
		const minibossCount = quest.minibossCount ?? 0;
		return THEME.objectives.surviveHostiles
			.replace('{count}', String(totalSpawns))
			.replace('{minibosses}', String(minibossCount));
	}

	return quest.description || '';
}

export function formatRewardSummary(quest) {
	if (!quest || quest.rewardCurrency == null) return 'Reward: —';
	return `Reward: ${quest.rewardCurrency} ${THEME.currency.short.toLowerCase()}`;
}

function updateQuestSelection(container, selectedQuestId) {
	container.querySelectorAll('.quest-card').forEach((card) => {
		card.classList.toggle('selected', card.dataset.questId === selectedQuestId);
	});
}

function questListKey(quests) {
	return (quests || []).map((q) => q.id).join('\0');
}

export function renderQuestBoard(container, quests, selectedQuestId, onSelectQuest) {
	if (!container) return;

	if (!quests || quests.length === 0) {
		container.replaceChildren();
		const empty = document.createElement('p');
		empty.className = 'quest-board-empty';
		empty.textContent = THEME.run.noContracts;
		container.appendChild(empty);
		container.dataset.questBoardKey = '';
		return;
	}

	const nextKey = `${questListKey(quests)}|${selectedQuestId}`;
	const existingCards = container.querySelectorAll('.quest-card');
	if (
		container.dataset.questBoardKey?.startsWith(`${questListKey(quests)}|`)
		&& existingCards.length === quests.length
	) {
		updateQuestSelection(container, selectedQuestId);
		container.dataset.questBoardKey = nextKey;
		return;
	}

	container.replaceChildren();

	for (const quest of quests) {
		const card = document.createElement('button');
		card.type = 'button';
		card.className = 'quest-card';
		card.dataset.questId = quest.id;
		if (quest.id === selectedQuestId) {
			card.classList.add('selected');
		}

		card.innerHTML = `
			<span class="quest-name">${quest.name}</span>
			<span class="quest-description">${quest.description}</span>
			<span class="quest-objective">${formatObjectiveSummary(quest)}</span>
			<span class="quest-reward">${formatRewardSummary(quest)}</span>
		`;

		if (typeof onSelectQuest === 'function') {
			card.addEventListener('click', () => onSelectQuest(quest.id));
		}

		container.appendChild(card);
	}

	container.dataset.questBoardKey = nextKey;
}
