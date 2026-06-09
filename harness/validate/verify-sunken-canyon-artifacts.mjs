#!/usr/bin/env node
/**
 * Verify game/validation/sunken-canyon/ artifacts came from a --steps full playthrough run.
 *
 *   node harness/validate/verify-sunken-canyon-artifacts.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { assertDistinctVictoryScreenshots } from './lib/distinctVictoryScreenshots.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SUNKEN_CANYON_DIR = path.join(REPO_ROOT, 'game', 'validation', 'sunken-canyon');
const SUNKEN_CANYON_REL = path.join('game', 'validation', 'sunken-canyon');

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
	const summaryPath = path.join(SUNKEN_CANYON_DIR, 'run-summary.json');
	if (!fs.existsSync(summaryPath)) {
		fail(errors, `missing ${SUNKEN_CANYON_REL}/run-summary.json (run pnpm validate:sunken-canyon first)`);
		return null;
	}

	let summary;
	try {
		summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
	} catch (err) {
		fail(errors, `run-summary.json is not valid JSON: ${err.message}`);
		return null;
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

function checkRequiredFiles(errors) {
	for (const name of REQUIRED_PNGS) {
		const filePath = path.join(SUNKEN_CANYON_DIR, name);
		if (!fs.existsSync(filePath)) {
			fail(errors, `missing ${name}`);
		}
	}

	for (const name of REQUIRED_FILES) {
		const filePath = path.join(SUNKEN_CANYON_DIR, name);
		if (!fs.existsSync(filePath)) {
			fail(errors, `missing ${name}`);
			continue;
		}
		if (name === 'findings.md') {
			const content = fs.readFileSync(filePath, 'utf8').trim();
			if (content.length === 0) {
				fail(errors, 'findings.md is empty');
			}
		}
	}
}

function checkOptionalExercisePngs(summary, errors) {
	const screenshots = Array.isArray(summary?.screenshots) ? summary.screenshots : [];
	for (const name of OPTIONAL_EXERCISE_PNGS) {
		const listed = screenshots.some((shot) => typeof shot === 'string' && shot.endsWith(`/${name}`));
		if (!listed) continue;
		const filePath = path.join(SUNKEN_CANYON_DIR, name);
		if (!fs.existsSync(filePath)) {
			fail(errors, `screenshots list includes ${name} but file is missing`);
		}
	}
}

function main() {
	const summaryPath = path.join(SUNKEN_CANYON_DIR, 'run-summary.json');
	if (!fs.existsSync(summaryPath)) {
		console.error(
			`verify-sunken-canyon-artifacts: missing ${SUNKEN_CANYON_REL}/run-summary.json (run pnpm validate:sunken-canyon first)`,
		);
		process.exit(1);
	}

	const errors = [];
	let summary = null;

	if (!fs.existsSync(SUNKEN_CANYON_DIR)) {
		errors.push(`missing validation directory: ${SUNKEN_CANYON_REL}/`);
	} else {
		summary = readRunSummary(errors);
		checkRequiredFiles(errors);
		if (summary) {
			checkOptionalExercisePngs(summary, errors);
		}
		assertDistinctVictoryScreenshots(SUNKEN_CANYON_DIR, errors, `${SUNKEN_CANYON_REL}/`);
	}

	if (errors.length > 0) {
		console.error(`verify-sunken-canyon-artifacts: ${SUNKEN_CANYON_REL}/ artifacts invalid:`);
		for (const message of errors) {
			console.error(`  - ${message}`);
		}
		process.exit(1);
	}

	process.exit(0);
}

main();
