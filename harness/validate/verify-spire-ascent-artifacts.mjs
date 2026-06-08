#!/usr/bin/env node
/**
 * Verify game/validation/spire-ascent/ artifacts came from a --steps full playthrough run.
 *
 *   node harness/validate/verify-spire-ascent-artifacts.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SPIRE_DIR = path.join(REPO_ROOT, 'game', 'validation', 'spire-ascent');
const SPIRE_REL = path.join('game', 'validation', 'spire-ascent');

const REQUIRED_ASSERTION_KEYS = [
	'bossSpawned',
	'encounterActivated',
	'bossDefeated',
	'victoryFired',
];

const REQUIRED_PNGS = [
	'01-hub.png',
	'02-level-entry.png',
	'03-mid-combat.png',
	'04-boss-dormant.png',
	'05-boss-active.png',
	// New-content probe screenshots (tickets 283/284/301/299/308/287/289). A run
	// without the new-content probes will not produce these, so requiring them
	// fails verification of any stale/base-only run.
	'05a-boss-healthbar.png',
	'05b-status-cards.png',
	'05c-windup.png',
	'06-boss-defeated.png',
	'07-victory.png',
	'08-telepipe-hub.png',
	'09-new-sortie-charges.png',
];

// New-content probe sections that a --steps full spire-ascent run must record in
// run-summary.json. bossUi/bossVisuals/statusCards/healCleanse/windUp live under
// the bossEncounter section; telepipePersistence/cardChargeReset are top-level.
const REQUIRED_BOSS_ENCOUNTER_PROBE_KEYS = [
	'bossUi',
	'bossVisuals',
	'statusCards',
	'healCleanse',
	'windUp',
];
const REQUIRED_TOP_LEVEL_PROBE_KEYS = [
	'telepipePersistence',
	'cardChargeReset',
];

const REQUIRED_FILES = [
	'findings.md',
	'probes.json',
	'console.log',
];

function fail(errors, message) {
	errors.push(message);
}

function readRunSummary(errors) {
	const summaryPath = path.join(SPIRE_DIR, 'run-summary.json');
	if (!fs.existsSync(summaryPath)) {
		fail(errors, `missing ${SPIRE_REL}/run-summary.json (run pnpm validate:spire-ascent first)`);
		return null;
	}

	let summary;
	try {
		summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
	} catch (err) {
		fail(errors, `run-summary.json is not valid JSON: ${err.message}`);
		return null;
	}

	if (summary.preset !== 'spire-ascent') {
		const actual = summary.preset == null ? '(missing)' : JSON.stringify(summary.preset);
		fail(errors, `run-summary.json preset must be "spire-ascent", got ${actual}`);
	}

	if (summary.steps !== 'full') {
		const actual = summary.steps == null ? '(missing)' : JSON.stringify(summary.steps);
		fail(errors, `run-summary.json steps must be "full", got ${actual}`);
	}

	if (!summary.assertions || typeof summary.assertions !== 'object' || Array.isArray(summary.assertions)) {
		fail(errors, 'run-summary.json missing assertions object');
	} else {
		for (const key of REQUIRED_ASSERTION_KEYS) {
			if (!Object.prototype.hasOwnProperty.call(summary.assertions, key)) {
				fail(errors, `run-summary.json assertions missing key "${key}"`);
			}
		}
	}

	if (!Object.prototype.hasOwnProperty.call(summary, 'victory')) {
		fail(errors, 'run-summary.json missing victory section');
	} else if (summary.victory == null || typeof summary.victory !== 'object' || Array.isArray(summary.victory)) {
		fail(errors, 'run-summary.json victory must be an object');
	}

	checkProbeSections(errors, summary);

	return summary;
}

function isPlainObject(value) {
	return value != null && typeof value === 'object' && !Array.isArray(value);
}

function checkProbeSections(errors, summary) {
	const bossEncounter = summary.bossEncounter;
	if (!isPlainObject(bossEncounter)) {
		fail(errors, 'run-summary.json missing bossEncounter section with the new-content probes');
	} else {
		for (const key of REQUIRED_BOSS_ENCOUNTER_PROBE_KEYS) {
			if (!isPlainObject(bossEncounter[key])) {
				fail(errors, `run-summary.json bossEncounter missing new-content probe section "${key}"`);
			}
		}
	}

	for (const key of REQUIRED_TOP_LEVEL_PROBE_KEYS) {
		if (!isPlainObject(summary[key])) {
			fail(errors, `run-summary.json missing new-content probe section "${key}"`);
		}
	}
}

function checkFindingsBossLabel(errors, content) {
	const bossSpawnedLine = content
		.split('\n')
		.find((line) => line.includes('bossSpawned'));
	if (!bossSpawnedLine) {
		fail(errors, 'findings.md missing bossSpawned assertion line');
		return;
	}
	if (bossSpawnedLine.includes('annex_overseer')) {
		fail(errors, 'findings.md bossSpawned line must not reference annex_overseer (Training Caverns boss)');
	}
	if (!bossSpawnedLine.includes('spire_warden') && !bossSpawnedLine.includes('Summit Warden')) {
		fail(errors, 'findings.md bossSpawned line must reference spire_warden or Summit Warden');
	}
}

function checkRequiredFiles(errors) {
	for (const name of REQUIRED_PNGS) {
		const filePath = path.join(SPIRE_DIR, name);
		if (!fs.existsSync(filePath)) {
			fail(errors, `missing ${name}`);
		}
	}

	for (const name of REQUIRED_FILES) {
		const filePath = path.join(SPIRE_DIR, name);
		if (!fs.existsSync(filePath)) {
			fail(errors, `missing ${name}`);
			continue;
		}
		if (name === 'findings.md') {
			const content = fs.readFileSync(filePath, 'utf8').trim();
			if (content.length === 0) {
				fail(errors, 'findings.md is empty');
			} else {
				checkFindingsBossLabel(errors, content);
			}
		}
	}
}

function main() {
	const summaryPath = path.join(SPIRE_DIR, 'run-summary.json');
	if (!fs.existsSync(summaryPath)) {
		console.error(
			`verify-spire-ascent-artifacts: missing ${SPIRE_REL}/run-summary.json (run pnpm validate:spire-ascent first)`,
		);
		process.exit(1);
	}

	const errors = [];

	if (!fs.existsSync(SPIRE_DIR)) {
		errors.push(`missing validation directory: ${SPIRE_REL}/`);
	} else {
		readRunSummary(errors);
		checkRequiredFiles(errors);
	}

	if (errors.length > 0) {
		console.error(`verify-spire-ascent-artifacts: ${SPIRE_REL}/ artifacts invalid:`);
		for (const message of errors) {
			console.error(`  - ${message}`);
		}
		process.exit(1);
	}

	process.exit(0);
}

main();
