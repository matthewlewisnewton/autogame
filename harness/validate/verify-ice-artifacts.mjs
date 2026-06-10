#!/usr/bin/env node
/**
 * Verify game/validation/ice/ artifacts came from a --steps full playthrough run.
 *
 *   node harness/validate/verify-ice-artifacts.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { assertDistinctVictoryScreenshots } from './lib/distinctVictoryScreenshots.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const ICE_DIR = path.join(REPO_ROOT, 'game', 'validation', 'ice');
const ICE_REL = path.join('game', 'validation', 'ice');

const REQUIRED_ASSERTION_KEYS = [
	'layoutDeployed',
	'enemiesCleared',
	'victoryFired',
	'slipperyFloorOk',
	'glacialSlowApplied',
	'cardMechanicsOk',
	'telepipeVitalsPreserved',
	'cardChargesResetOnFreshSortie',
];

const REQUIRED_PNGS = [
	'01-hub.png',
	'02-level-entry.png',
	'03-slippery-floor.png',
	'04-mid-combat.png',
	'05-glacial-slow.png',
	'06-card-burn.png',
	'07-objective-complete.png',
	'08-victory.png',
	'09-telepipe-before.png',
	'10-telepipe-after.png',
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
	const summaryPath = path.join(ICE_DIR, 'run-summary.json');
	if (!fs.existsSync(summaryPath)) {
		fail(errors, `missing ${ICE_REL}/run-summary.json (run pnpm validate:ice first)`);
		return null;
	}

	let summary;
	try {
		summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
	} catch (err) {
		fail(errors, `run-summary.json is not valid JSON: ${err.message}`);
		return null;
	}

	if (summary.preset !== 'ice') {
		const actual = summary.preset == null ? '(missing)' : JSON.stringify(summary.preset);
		fail(errors, `run-summary.json preset must be "ice", got ${actual}`);
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
		if (Object.prototype.hasOwnProperty.call(summary.assertions, 'emberBurnApplied')) {
			fail(errors, 'run-summary.json assertions must not include emberBurnApplied for ice preset');
		}
	}

	if (!Object.prototype.hasOwnProperty.call(summary, 'victory')) {
		fail(errors, 'run-summary.json missing victory section');
	} else if (summary.victory == null || typeof summary.victory !== 'object' || Array.isArray(summary.victory)) {
		fail(errors, 'run-summary.json victory must be an object');
	}

	return summary;
}

function checkGlacialSlowConsistency(summary, errors) {
	const glacial = summary?.glacialSlow;
	if (!glacial || typeof glacial !== 'object' || Array.isArray(glacial)) {
		fail(errors, 'run-summary.json missing glacialSlow object');
		return;
	}
	if (summary.assertions?.glacialSlowApplied === true && glacial.glacialSlowApplied !== true) {
		fail(errors, 'assertions.glacialSlowApplied is true but glacialSlow.glacialSlowApplied is not');
	}
}

function checkSlipperyFloorConsistency(summary, errors) {
	const slippery = summary?.slipperyFloor;
	if (!slippery || typeof slippery !== 'object' || Array.isArray(slippery)) {
		fail(errors, 'run-summary.json missing slipperyFloor object');
		return;
	}
	if (summary.assertions?.slipperyFloorOk === true && slippery.ok !== true) {
		fail(errors, 'assertions.slipperyFloorOk is true but slipperyFloor.ok is not');
	}
}

function checkTelepipeRunIdSanity(summary, errors) {
	const reset = summary?.telepipeReset;
	if (!reset) return;
	const preId = reset.preSuspend?.runId;
	const postId = reset.postDeploy?.runId;
	if (preId == null || postId == null) return;
	if (preId === postId && summary.assertions?.telepipeVitalsPreserved === true) {
		fail(
			errors,
			`telepipeReset runId unchanged (${preId}) while assertions.telepipeVitalsPreserved is true`,
		);
	}
}

function checkRequiredFiles(errors) {
	for (const name of REQUIRED_PNGS) {
		const filePath = path.join(ICE_DIR, name);
		if (!fs.existsSync(filePath)) {
			fail(errors, `missing ${name}`);
		}
	}

	for (const name of REQUIRED_FILES) {
		const filePath = path.join(ICE_DIR, name);
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

function main() {
	const summaryPath = path.join(ICE_DIR, 'run-summary.json');
	if (!fs.existsSync(summaryPath)) {
		console.error(
			`verify-ice-artifacts: missing ${ICE_REL}/run-summary.json (run pnpm validate:ice first)`,
		);
		process.exit(1);
	}

	const errors = [];

	if (!fs.existsSync(ICE_DIR)) {
		errors.push(`missing validation directory: ${ICE_REL}/`);
	} else {
		const summary = readRunSummary(errors);
		if (summary) {
			checkSlipperyFloorConsistency(summary, errors);
			checkGlacialSlowConsistency(summary, errors);
			checkTelepipeRunIdSanity(summary, errors);
		}
		checkRequiredFiles(errors);
		assertDistinctVictoryScreenshots(ICE_DIR, errors, `${ICE_REL}/`);
	}

	if (errors.length > 0) {
		console.error(`verify-ice-artifacts: ${ICE_REL}/ artifacts invalid:`);
		for (const message of errors) {
			console.error(`  - ${message}`);
		}
		process.exit(1);
	}

	process.exit(0);
}

main();
