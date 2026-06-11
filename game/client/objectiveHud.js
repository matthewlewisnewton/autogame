/**
 * Pure helpers for the run objective HUD (#objective-hud).
 * Stage-boss formatting lives here; other objective types return empty progress
 * so later sub-tickets can extend the same module.
 */

import { formatObjectiveSummary } from './questBoard.js';
import { THEME } from './theme.js';

function resolveQuestForObjective(run, questMeta) {
	const questId = run?.questId || questMeta?.questId || questMeta?.id;
	return {
		...(questMeta || {}),
		id: questId || questMeta?.id,
		questId,
		objectiveType: 'stage_boss',
		encounter: {
			...(questMeta?.encounter || {}),
			...(run?.encounter || {}),
		},
		scriptedEncounters: questMeta?.scriptedEncounters
			|| run?._scriptedEncounterConfig
			|| undefined,
	};
}

function roomKeyForDef(roomDef) {
	if (Number.isInteger(roomDef?.roomIndex) && roomDef.roomIndex >= 0) {
		return `room:${roomDef.roomIndex}`;
	}
	if (typeof roomDef?.band === 'string' && roomDef.band.length > 0) {
		return `band:${roomDef.band}`;
	}
	if (typeof roomDef?.landmark === 'string' && roomDef.landmark.length > 0) {
		return `landmark:${roomDef.landmark}`;
	}
	return null;
}

function countAuthoredScriptedWaves(config) {
	const rooms = config?.rooms;
	if (!Array.isArray(rooms)) return 0;
	return rooms.reduce((sum, room) => {
		const waves = Array.isArray(room?.waves) ? room.waves.length : 0;
		return sum + waves;
	}, 0);
}

function countClearedScriptedWaves(run, config) {
	const runtimeRooms = run?.scriptedEncounter?.rooms;
	const configRooms = config?.rooms;
	if (!runtimeRooms || !Array.isArray(configRooms)) return 0;

	let cleared = 0;
	for (const roomDef of configRooms) {
		const roomKey = roomKeyForDef(roomDef);
		if (!roomKey) continue;
		const roomState = runtimeRooms[roomKey];
		const totalWaves = Array.isArray(roomDef.waves) ? roomDef.waves.length : 0;
		if (!roomState) continue;
		if (roomState.cleared) {
			cleared += totalWaves;
		} else if (roomState.waveIndex >= 0) {
			cleared += roomState.waveIndex;
		}
	}
	return cleared;
}

function isStageBossComplete(run, objective) {
	if (objective?.bossDefeated) return true;
	if (run?.encounter?.phase === 'cleared') return true;
	return false;
}

function buildStageBossProgressSuffix(run, objective, quest) {
	if (isStageBossComplete(run, objective)) {
		return THEME.objectives.stageBossDefeated;
	}

	const parts = [];
	const scriptedConfig = run?._scriptedEncounterConfig || quest?.scriptedEncounters;
	if (run?.scriptedEncounter?.rooms && scriptedConfig) {
		const total = countAuthoredScriptedWaves(scriptedConfig);
		const cleared = countClearedScriptedWaves(run, scriptedConfig);
		if (total > 0) {
			parts.push(
				THEME.objectives.scriptedWavesCleared
					.replace('{cleared}', String(cleared))
					.replace('{total}', String(total)),
			);
		}
	}

	const addCount = objective?.addCount ?? quest?.encounter?.addCount ?? 0;
	const totalEnemies = objective?.totalEnemies ?? 0;
	if (addCount > 0 || totalEnemies > 1) {
		const supportTotal = addCount > 0 ? addCount : Math.max(0, totalEnemies - 1);
		const defeated = Math.min(objective?.defeatedEnemies ?? 0, supportTotal);
		parts.push(
			THEME.objectives.supportsClearedProgress
				.replace('{cleared}', String(defeated))
				.replace('{total}', String(supportTotal)),
		);
	}

	return parts.join(' · ');
}

function combineGoalAndProgress(goal, suffix) {
	if (!suffix) return goal;
	return `${goal} — ${suffix}`;
}

/**
 * @param {{ run?: object, questMeta?: object|null }} args
 * @returns {{ goalLine: string, secondLine: string }}
 */
export function formatRunObjectiveHudLines({ run, questMeta } = {}) {
	if (!run?.objective || run.objective.type !== 'stage_boss') {
		return { goalLine: '', secondLine: '' };
	}

	const quest = resolveQuestForObjective(run, questMeta);
	const goalLine = formatObjectiveSummary(quest);
	const progressSuffix = buildStageBossProgressSuffix(run, run.objective, quest);
	const secondLine = combineGoalAndProgress(goalLine, progressSuffix);

	return { goalLine, secondLine };
}
