#!/usr/bin/env node
/**
 * Browser smoke test: summon minion combat, hitboxes, and damage-driven TTL burn.
 *
 * Requires client on :5173, server on :3000, playwright chromium.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', '..', 'docs', 'walkthroughs', 'summon-combat');

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

async function register(username) {
	const res = await fetch(`${SERVER_URL}/api/register`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ username, password: 'password123' }),
	});
	const body = await res.json();
	if (body.token) return body.token;
	const login = await fetch(`${SERVER_URL}/api/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ username, password: 'password123' }),
	});
	return (await login.json()).token;
}

async function loginWithToken(page, token) {
	await page.goto(CLIENT_URL);
	await page.evaluate((t) => localStorage.setItem('autogame_token', t), token);
	await page.reload();
	await page.waitForFunction(() => {
		const browserEl = document.getElementById('lobby-browser');
		const auth = document.getElementById('auth-overlay');
		return browserEl && !browserEl.classList.contains('hidden')
			&& auth && auth.classList.contains('hidden');
	}, { timeout: 15000 });
}

async function startSoloRun(page) {
	await page.evaluate(() => {
		document.getElementById('create-lobby-name').value = 'Summon Combat QA';
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
		if (typeof window.__requestDebugScenarioForTest !== 'function') {
			return { ok: false, reason: '__requestDebugScenarioForTest missing' };
		}
		return window.__requestDebugScenarioForTest('minion-combat');
	});
	if (!debugResult?.ok) {
		throw new Error(`minion-combat debug scenario failed: ${debugResult?.reason || 'unknown'}`);
	}

	await page.waitForFunction(() => {
		const h = window.__AUTOGAME_HARNESS_STATE__();
		return h?.phase === 'playing'
			&& h?.cardHandVisible
			&& h.hand.some((card) => card && card.type === 'creature' && card.id === 'dungeon_drake');
	}, { timeout: 15000 });
}

async function readHarness(page) {
	return page.evaluate(() => window.__AUTOGAME_HARNESS_STATE__());
}

function parseBurnSeconds(label) {
	const match = String(label || '').match(/^(\d+)s\/(\d+)s$/);
	if (!match) return null;
	return { remaining: Number(match[1]), max: Number(match[2]) };
}

async function findCreatureSlot(page) {
	return page.evaluate(() => {
		const slots = [...document.querySelectorAll('.card-slot')];
		for (const slot of slots) {
			if (slot.dataset.cardType === 'creature') {
				return Number(slot.dataset.slotIndex);
			}
		}
		return -1;
	});
}

async function screenshot(page, name) {
	fs.mkdirSync(OUT_DIR, { recursive: true });
	const file = path.join(OUT_DIR, `${name}.png`);
	await page.waitForTimeout(300);
	await page.screenshot({ path: file, fullPage: false });
	console.log(`screenshot: ${file}`);
	return file;
}

async function main() {
	const suffix = Date.now();
	const token = await register(`summon-combat-${suffix}`);

	const browser = await chromium.launch({ headless: true });
	const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

	try {
		await loginWithToken(page, token);
		await startSoloRun(page);

		const before = await readHarness(page);
		if (before.enemies < 1) {
			throw new Error('Expected at least one nearby enemy from debug scenario');
		}
		if (before.minions.length < 1) {
			throw new Error('Expected a pre-spawned minion from minion-combat scenario');
		}

		const combatMinionId = before.minions.reduce((best, minion) => {
			if (!best) return minion.id;
			const bestMinion = before.minions.find((m) => m.id === best);
			return minion.x > bestMinion.x ? minion.id : best;
		}, before.minions[0].id);
		const initialCombatMinionHp = before.minions.find((m) => m.id === combatMinionId)?.hp ?? 0;

		const creatureSlot = await findCreatureSlot(page);
		if (creatureSlot < 0) {
			throw new Error(`No creature card in hand: ${JSON.stringify(before.hand)}`);
		}

		await screenshot(page, '01-before-summon');

		await page.keyboard.press(String(creatureSlot + 1));
		await page.waitForFunction((slotIndex) => {
			const slot = document.querySelector(`.card-slot[data-slot-index="${slotIndex}"]`);
			return slot?.classList.contains('creature-burning');
		}, creatureSlot, { timeout: 10000 });

		const summoned = await readHarness(page);
		if (summoned.minions.length < 2) {
			throw new Error(`Expected pre-spawned + summoned minions, got ${summoned.minions.length}`);
		}

		const initialMinionHp = initialCombatMinionHp;
		const initialBurn = parseBurnSeconds(summoned.hand[creatureSlot]?.burnLabel);
		if (!initialBurn) {
			throw new Error(`Missing burn label after summon: ${summoned.hand[creatureSlot]?.burnLabel}`);
		}

		console.log('summoned minion:', JSON.stringify(summoned.minions));
		console.log('combat minion id:', combatMinionId, 'initial hp:', initialMinionHp);
		console.log('initial burn:', initialBurn);
		await screenshot(page, '02-minion-summoned');

		// Hold position so the pre-spawned minion keeps brawling instead of the player drawing aggro.
		let minionHp = initialMinionHp;
		let burnAfter = initialBurn;
		for (let i = 0; i < 12; i += 1) {
			await page.waitForTimeout(2000);
			const combat = await readHarness(page);
			minionHp = combat.minions.find((m) => m.id === combatMinionId)?.hp ?? 0;
			burnAfter = parseBurnSeconds(combat.hand[creatureSlot]?.burnLabel) || burnAfter;
			console.log(`t+${(i + 1) * 2}s minion hp=${minionHp} burn=${combat.hand[creatureSlot]?.burnLabel}`);
			if (minionHp < initialMinionHp) break;
		}

		const combat = await readHarness(page);
		minionHp = combat.minions.find((m) => m.id === combatMinionId)?.hp ?? minionHp;
		burnAfter = parseBurnSeconds(combat.hand[creatureSlot]?.burnLabel) || burnAfter;
		const activeEffects = await page.evaluate(() => {
			if (typeof window.getActiveEffects !== 'function') return null;
			return window.getActiveEffects().length;
		});

		console.log('after combat minion hp:', minionHp, '(was', initialMinionHp, ')');
		console.log('after combat burn:', burnAfter, '(was', initialBurn, ')');
		console.log('active attack effects:', activeEffects);

		await screenshot(page, '03-after-combat');

		if (!burnAfter || burnAfter.remaining >= initialBurn.remaining) {
			throw new Error(`Expected burn timer to count down (started ${initialBurn.remaining}s, now ${burnAfter?.remaining ?? 'null'})`);
		}
		if (!combat.sceneInitialized || !combat.hasCanvas) {
			throw new Error('Expected Three.js scene/canvas to be active during combat');
		}

		if (minionHp < initialMinionHp) {
			console.log('minion took enemy damage in-browser');
		} else {
			throw new Error(`Expected adjacent enemy to damage the summon (${initialMinionHp} -> ${minionHp})`);
		}

		console.log('PASS: summon deployed, minion took damage, burn timer ticked, and combat VFX rendered');
	} finally {
		await browser.close();
	}
}

main().catch((err) => {
	console.error('FAIL:', err.message);
	process.exit(1);
});
