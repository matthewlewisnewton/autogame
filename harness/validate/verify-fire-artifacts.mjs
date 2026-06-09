#!/usr/bin/env node
/**
 * Verify game/validation/fire/ artifacts came from a --steps full playthrough run.
 *
 *   node harness/validate/verify-fire-artifacts.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { assertDistinctVictoryScreenshots } from './lib/distinctVictoryScreenshots.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const FIRE_DIR = path.join(REPO_ROOT, 'game', 'validation', 'fire');
const FIRE_REL = path.join('game', 'validation', 'fire');

const REQUIRED_ASSERTION_KEYS = [
	'layoutDeployed',
	'enemiesCleared',
	'victoryFired',
	'emberBurnApplied',
	'cardMechanicsOk',
	'telepipeVitalsPreserved',
	'cardChargesResetOnFreshSortie',
];

const REQUIRED_PNGS = [
	'01-hub.png',
	'02-level-entry.png',
	'03-mid-combat.png',
	'04-ember-burn.png',
	'05-card-burn.png',
	'06-objective-complete.png',
	'07-victory.png',
	'08-telepipe-before.png',
	'09-telepipe-after.png',
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
	const summaryPath = path.join(FIRE_DIR, 'run-summary.json');
	if (!fs.existsSync(summaryPath)) {
		fail(errors, `missing ${FIRE_REL}/run-summary.json (run pnpm validate:fire first)`);
		return null;
	}

	let summary;
	try {
		summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
	} catch (err) {
		fail(errors, `run-summary.json is not valid JSON: ${err.message}`);
		return null;
	}

	if (summary.preset !== 'fire') {
		const actual = summary.preset == null ? '(missing)' : JSON.stringify(summary.preset);
		fail(errors, `run-summary.json preset must be "fire", got ${actual}`);
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

function checkEmberBurnConsistency(summary, errors) {
	const ember = summary?.emberBurn;
	if (!ember || typeof ember !== 'object' || Array.isArray(ember)) {
		fail(errors, 'run-summary.json missing emberBurn object');
		return;
	}

	if (ember.burnTickDamageApplied !== true) {
		fail(errors, 'emberBurn.burnTickDamageApplied must be true (burn ticks must reduce HP)');
	}
	if (ember.debugGodmodeOff !== true) {
		fail(errors, 'emberBurn.debugGodmodeOff must be true');
	}
	if (!(Number.isFinite(ember.hpDelta) && ember.hpDelta < 0)) {
		fail(errors, `emberBurn.hpDelta must be negative, got ${ember.hpDelta}`);
	}
	if (ember.emberBurnApplied === true && ember.burnTickDamageApplied !== true) {
		fail(errors, 'emberBurn.emberBurnApplied is true but burnTickDamageApplied is not');
	}
	if (summary.assertions?.emberBurnApplied === true && ember.burnTickDamageApplied !== true) {
		fail(errors, 'assertions.emberBurnApplied is true but emberBurn.burnTickDamageApplied is not');
	}
	if (ember.burnTickDamageApplied === true && !(Number.isFinite(ember.hpDelta) && ember.hpDelta < 0)) {
		fail(errors, 'emberBurn.burnTickDamageApplied is true but hpDelta is not negative');
	}

	const findingsPath = path.join(FIRE_DIR, 'findings.md');
	if (fs.existsSync(findingsPath)) {
		const findings = fs.readFileSync(findingsPath, 'utf8');
		if (!findings.includes('burnTickDamageApplied**: PASS')) {
			fail(errors, 'findings.md Ember burn section missing burnTickDamageApplied: PASS');
		}
		if (!findings.includes('emberBurnApplied**: PASS')) {
			fail(errors, 'findings.md Ember burn section missing emberBurnApplied: PASS');
		}
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
		const filePath = path.join(FIRE_DIR, name);
		if (!fs.existsSync(filePath)) {
			fail(errors, `missing ${name}`);
		}
	}

	for (const name of REQUIRED_FILES) {
		const filePath = path.join(FIRE_DIR, name);
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
	const summaryPath = path.join(FIRE_DIR, 'run-summary.json');
	if (!fs.existsSync(summaryPath)) {
		console.error(
			`verify-fire-artifacts: missing ${FIRE_REL}/run-summary.json (run pnpm validate:fire first)`,
		);
		process.exit(1);
	}

	const errors = [];

	if (!fs.existsSync(FIRE_DIR)) {
		errors.push(`missing validation directory: ${FIRE_REL}/`);
	} else {
		const summary = readRunSummary(errors);
		if (summary) {
			checkEmberBurnConsistency(summary, errors);
			checkTelepipeRunIdSanity(summary, errors);
		}
		checkRequiredFiles(errors);
		assertDistinctVictoryScreenshots(FIRE_DIR, errors, `${FIRE_REL}/`);
	}

	if (errors.length > 0) {
		console.error(`verify-fire-artifacts: ${FIRE_REL}/ artifacts invalid:`);
		for (const message of errors) {
			console.error(`  - ${message}`);
		}
		process.exit(1);
	}

	process.exit(0);
}

main();
