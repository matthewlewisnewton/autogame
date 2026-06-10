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
	'bossEncounterUiVisible',
	'bossDistinctFromAdds',
	'slowBurnMutuallyExclusive',
	'healCleanseApplied',
	'windupTelegraphActive',
	'telepipeVitalsPreserved',
	'cardChargesResetOnNewSortie',
];

const REQUIRED_PNGS = [
	'01-hub.png',
	'02-level-entry.png',
	'03-mid-combat.png',
	'04-boss-dormant.png',
	'05-boss-active.png',
	'06-boss-defeated.png',
	'07-victory.png',
];

const OPTIONAL_EXERCISE_PNGS = [
	'08-slow-burn-mutual-exclusive.png',
	'09-purifying-pulse.png',
	'10-windup-charge.png',
	'11-telepipe-before.png',
	'12-telepipe-after.png',
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

	return summary;
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

function checkOptionalExercisePngs(summary, errors) {
	const screenshots = Array.isArray(summary?.screenshots) ? summary.screenshots : [];
	for (const name of OPTIONAL_EXERCISE_PNGS) {
		const listed = screenshots.some((shot) => typeof shot === 'string' && shot.endsWith(`/${name}`));
		if (!listed) continue;
		const filePath = path.join(SPIRE_DIR, name);
		if (!fs.existsSync(filePath)) {
			fail(errors, `screenshots list includes ${name} but file is missing`);
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
	let summary = null;

	if (!fs.existsSync(SPIRE_DIR)) {
		errors.push(`missing validation directory: ${SPIRE_REL}/`);
	} else {
		summary = readRunSummary(errors);
		checkRequiredFiles(errors);
		if (summary) {
			checkOptionalExercisePngs(summary, errors);
		}
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
