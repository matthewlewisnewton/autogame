#!/usr/bin/env node
/**
 * Browser smoke test: Vault Wyrm channeled breath (tick damage + fading cone VFX).
 *
 * Requires client on :5173, server on :3000, playwright chromium.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loginInBrowser } from './session-auth.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', '..', 'docs', 'walkthroughs', 'wyrm-breath');

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
	await page.evaluate(() => {
		document.getElementById('create-lobby-name').value = 'Wyrm Breath QA';
		document.getElementById('create-lobby-btn')?.click();
	});
	await page.waitForFunction(() => {
		const lobby = document.getElementById('lobby');
		return lobby && !lobby.classList.contains('hidden');
	}, { timeout: 10000 });
	await page.evaluate(() => document.getElementById('ready-btn')?.click());
	await page.waitForFunction(() => {
		const ui = document.getElementById('ui');
		return ui && ui.style.display === 'block';
	}, { timeout: 15000 });

	const debugResult = await page.evaluate(async () => {
		return window.__requestDebugScenarioForTest('minion-combat');
	});
	if (!debugResult?.ok) {
		throw new Error(`minion-combat debug scenario failed: ${debugResult?.reason || 'unknown'}`);
	}

	await page.waitForFunction(() => {
		const h = window.__AUTOGAME_HARNESS_STATE__();
		return h?.phase === 'playing'
			&& h.enemies >= 1
			&& h.minions.some((minion) => minion.type === 'dungeon_drake');
	}, { timeout: 15000 });
}

async function readHarness(page) {
	return page.evaluate(() => window.__AUTOGAME_HARNESS_STATE__());
}

async function readEffects(page) {
	return page.evaluate(() => {
		if (typeof window.activeEffects !== 'function') return null;
		return window.activeEffects().map((fx) => ({
			isWeaponCone: !!fx.isWeaponCone,
			duration: fx.duration,
			coneAngle: fx.coneAngle,
			range: fx.range,
		}));
	});
}

async function screenshot(page, name) {
	fs.mkdirSync(OUT_DIR, { recursive: true });
	const file = path.join(OUT_DIR, `${name}.png`);
	await page.waitForTimeout(250);
	await page.screenshot({ path: file, fullPage: false });
	console.log(`screenshot: ${file}`);
	return file;
}

function countHpChanges(samples) {
	let changes = 0;
	for (let i = 1; i < samples.length; i += 1) {
		if (samples[i] !== samples[i - 1]) changes += 1;
	}
	return changes;
}

async function main() {
	const browser = await chromium.launch({ headless: true });
	const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

	try {
		await loginInBrowser(page, CLIENT_URL, `wyrm-breath-${Date.now()}`);
		await startMinionCombatScenario(page);

		const start = await readHarness(page);
		const startEnemyHp = start.enemyHp?.[0]?.hp;
		if (!Number.isFinite(startEnemyHp)) {
			throw new Error(`Expected enemy HP in harness, got ${JSON.stringify(start.enemyHp)}`);
		}

		console.log('initial enemy hp:', startEnemyHp);
		await screenshot(page, '01-combat-start');

		const hpSamples = [startEnemyHp];
		const effectSamples = [];
		for (let i = 0; i < 16; i += 1) {
			await page.waitForTimeout(150);
			const h = await readHarness(page);
			hpSamples.push(h.enemyHp?.[0]?.hp ?? hpSamples[hpSamples.length - 1]);
			effectSamples.push(await readEffects(page));
		}

		const endEnemyHp = hpSamples[hpSamples.length - 1];
		const hpChanges = countHpChanges(hpSamples);
		const maxConeEffects = effectSamples.reduce((max, effects) => {
			const count = Array.isArray(effects)
				? effects.filter((fx) => fx.isWeaponCone).length
				: 0;
			return Math.max(max, count);
		}, 0);
		const sawCone = effectSamples.some(
			(effects) => Array.isArray(effects) && effects.some((fx) => fx.isWeaponCone),
		);

		console.log('hp samples:', hpSamples.join(' -> '));
		console.log('hp changes in ~2.4s:', hpChanges);
		console.log('enemy hp delta:', startEnemyHp - endEnemyHp);
		console.log('max simultaneous cone effects:', maxConeEffects);
		console.log('saw cone VFX:', sawCone);

		await screenshot(page, '02-during-breath');

		if (endEnemyHp >= startEnemyHp) {
			throw new Error(`Expected enemy to take breath damage (${startEnemyHp} -> ${endEnemyHp})`);
		}
		if (hpChanges > 6) {
			throw new Error(`Expected ticked breath (~4 ticks/2.4s), got ${hpChanges} HP changes: ${hpSamples.join(' -> ')}`);
		}
		if (hpChanges < 1) {
			throw new Error('Expected at least one breath damage tick in the sample window');
		}
		if (maxConeEffects > 2) {
			throw new Error(`Expected one channeled cone VFX, saw up to ${maxConeEffects} stacked cones`);
		}
		if (!sawCone) {
			throw new Error('Expected to observe a weapon cone VFX during the breath channel');
		}

		const longestCone = effectSamples
			.flatMap((effects) => (Array.isArray(effects) ? effects : []))
			.filter((fx) => fx.isWeaponCone)
			.reduce((max, fx) => Math.max(max, fx.duration || 0), 0);
		if (longestCone < 1500) {
			throw new Error(`Expected channeled cone duration >= 1500ms, saw ${longestCone}`);
		}

		console.log('PASS: channeled wyrm breath ticks damage and renders a single fading cone');
	} finally {
		await browser.close();
	}
}

main().catch((err) => {
	console.error('FAIL:', err.message);
	process.exit(1);
});
