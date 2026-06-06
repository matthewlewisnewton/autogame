#!/usr/bin/env node
/**
 * Verify game/validation/hub/ artifacts came from a --steps full playthrough run.
 *
 *   node harness/validate/verify-hub-artifacts.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const HUB_DIR = path.join(REPO_ROOT, 'game', 'validation', 'hub');
const HUB_REL = path.join('game', 'validation', 'hub');

const REQUIRED_ASSERTION_KEYS = [
	'boothDeductsGold',
	'hatSwapFree',
	'telepipeVitalsPreserved',
];

const REQUIRED_PNGS = [
	'01-hub-overview.png',
	'02-room-operations.png',
	'03-room-commerce.png',
	'04-room-salon.png',
	'05-booth-paid.png',
	'06-hat-swap.png',
	'07-telepipe-before.png',
	'08-telepipe-after.png',
	'09-lobby-finder.png',
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
	const summaryPath = path.join(HUB_DIR, 'run-summary.json');
	if (!fs.existsSync(summaryPath)) {
		fail(errors, `missing ${HUB_REL}/run-summary.json (run pnpm validate:hub first)`);
		return null;
	}

	let summary;
	try {
		summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
	} catch (err) {
		fail(errors, `run-summary.json is not valid JSON: ${err.message}`);
		return null;
	}

	if (summary.preset !== 'hub') {
		const actual = summary.preset == null ? '(missing)' : JSON.stringify(summary.preset);
		fail(errors, `run-summary.json preset must be "hub", got ${actual}`);
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

	return summary;
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
		const filePath = path.join(HUB_DIR, name);
		if (!fs.existsSync(filePath)) {
			fail(errors, `missing ${name}`);
		}
	}

	for (const name of REQUIRED_FILES) {
		const filePath = path.join(HUB_DIR, name);
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
	const summaryPath = path.join(HUB_DIR, 'run-summary.json');
	if (!fs.existsSync(summaryPath)) {
		console.error(
			`verify-hub-artifacts: missing ${HUB_REL}/run-summary.json (run pnpm validate:hub first)`,
		);
		process.exit(1);
	}

	const errors = [];

	if (!fs.existsSync(HUB_DIR)) {
		errors.push(`missing validation directory: ${HUB_REL}/`);
	} else {
		const summary = readRunSummary(errors);
		if (summary) checkTelepipeRunIdSanity(summary, errors);
		checkRequiredFiles(errors);
	}

	if (errors.length > 0) {
		console.error(`verify-hub-artifacts: ${HUB_REL}/ artifacts invalid:`);
		for (const message of errors) {
			console.error(`  - ${message}`);
		}
		process.exit(1);
	}

	process.exit(0);
}

main();
