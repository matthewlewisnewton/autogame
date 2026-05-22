/**
 * Lobby quest board helpers — pure functions for rendering quest selection UI.
 */

export function formatObjectiveSummary(quest) {
	if (!quest) return '';

	if (quest.objectiveType === 'collect_items') {
		const itemCount = quest.itemCount ?? 0;
		const enemyCount = quest.enemyCount ?? 0;
		return `Collect ${itemCount} crystals (defeat ${enemyCount} enemies for now)`;
	}

	if (quest.objectiveType === 'defeat_enemies') {
		const enemyCount = quest.enemyCount ?? 0;
		return `Defeat ${enemyCount} enemies`;
	}

	return quest.description || '';
}

export function formatRewardSummary(quest) {
	if (!quest || quest.rewardCurrency == null) return 'Reward: —';
	return `Reward: ${quest.rewardCurrency} gold`;
}

export function renderQuestBoard(container, quests, selectedQuestId, onSelectQuest) {
	if (!container) return;

	container.innerHTML = '';

	if (!quests || quests.length === 0) {
		container.innerHTML = '<p class="quest-board-empty">No quests available</p>';
		return;
	}

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
}
