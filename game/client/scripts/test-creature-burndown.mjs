#!/usr/bin/env node
/**
 * Playwright verification: creature cards stay in hand and burn down while
 * the summoned minion is active (Lost Kingdoms-style duration).
 *
 * After minion expiry the slot empties immediately; passive draw refills it.
 * Run the server with PASSIVE_DRAW_INTERVAL_MS=500 for faster refill capture.
 *
 * Requires: client on :5173, server on :3000, playwright chromium.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', '..', 'docs', 'walkthroughs', 'creature-burndown');

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const PASSIVE_DRAW_WAIT_MS = Number(process.env.PASSIVE_DRAW_WAIT_MS) || 8000;

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
		document.getElementById('create-lobby-name').value = 'Creature Burndown QA';
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
		return window.__requestDebugScenarioForTest('monster-card');
	});
	if (!debugResult?.ok) {
		throw new Error(`monster-card debug scenario failed: ${debugResult?.reason || 'unknown'}`);
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

async function screenshotHand(page, name) {
	fs.mkdirSync(OUT_DIR, { recursive: true });
	const file = path.join(OUT_DIR, `${name}.png`);
	const hand = page.locator('#card-hand');
	await hand.waitFor({ state: 'visible', timeout: 10000 });
	await page.waitForTimeout(350);
	await hand.screenshot({ path: file });
	console.log(`screenshot: ${file}`);
	return file;
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

async function main() {
	const suffix = Date.now();
	const token = await register(`creature-burn-${suffix}`);

	const browser = await chromium.launch({ headless: true });
	const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

	await loginWithToken(page, token);
	await startSoloRun(page);

	const before = await readHarness(page);
	const creatureSlot = await findCreatureSlot(page);
	if (creatureSlot < 0) {
		throw new Error(`No creature card in hand: ${JSON.stringify(before.hand)}`);
	}

	const creatureBefore = before.hand[creatureSlot];
	if (!creatureBefore || creatureBefore.id !== 'dungeon_drake') {
		throw new Error(`Expected dungeon_drake in slot ${creatureSlot}, got ${JSON.stringify(creatureBefore)}`);
	}
	if (creatureBefore.activeMinionId) {
		throw new Error('Creature card already burning before play');
	}

	console.log('hand before play:', JSON.stringify(creatureBefore));
	await screenshotHand(page, '01-before-creature-play');

	const key = String(creatureSlot + 1);
	await page.keyboard.press(key);
	await page.waitForFunction((slotIndex) => {
		const slot = document.querySelector(`.card-slot[data-slot-index="${slotIndex}"]`);
		return slot?.classList.contains('creature-burning');
	}, creatureSlot, { timeout: 10000 });

	const burning = await readHarness(page);
	const burningCard = burning.hand[creatureSlot];
	const burnLabel = burningCard?.burnLabel;
	const burnParsed = parseBurnSeconds(burnLabel);

	console.log('hand while burning:', JSON.stringify(burningCard));
	console.log('minions:', JSON.stringify(burning.minions));

	if (!burningCard?.activeMinionId) {
		throw new Error('Expected activeMinionId on hand card after summon');
	}
	if (!burningCard?.creatureBurning) {
		throw new Error('Expected creature-burning class after summon');
	}
	if (!burnParsed || burnParsed.max < 1) {
		throw new Error(`Expected burn countdown label like "30s/30s", got "${burnLabel}"`);
	}
	if (burning.minions.length < 1) {
		throw new Error('Expected at least one minion on the battlefield');
	}
	if (burning.minions[0].ownerId !== burning.myId) {
		throw new Error('Spawned minion is not owned by the player');
	}

	await screenshotHand(page, '02-creature-burning-active');

	await page.waitForTimeout(4500);
	const ticking = await readHarness(page);
	const tickLabel = ticking.hand[creatureSlot]?.burnLabel;
	const tickParsed = parseBurnSeconds(tickLabel);
	console.log('burn label after 4.5s:', tickLabel);

	if (!tickParsed || tickParsed.remaining >= burnParsed.remaining) {
		throw new Error(`Burn countdown did not decrease (${burnLabel} -> ${tickLabel})`);
	}

	await screenshotHand(page, '03-creature-burning-countdown');

	await page.waitForFunction((slotIndex) => {
		const h = window.__AUTOGAME_HARNESS_STATE__();
		return !h?.hand?.[slotIndex];
	}, creatureSlot, { timeout: 40000 });

	const afterExpiry = await readHarness(page);
	console.log('hand after minion expiry:', JSON.stringify(afterExpiry.hand[creatureSlot]));
	console.log('minions remaining:', afterExpiry.minions.length);

	if (afterExpiry.minions.some((m) => m.ownerId === afterExpiry.myId)) {
		throw new Error('Player minion still active after card slot was exhausted');
	}

	await screenshotHand(page, '04-empty-slot-after-expiry');

	await page.waitForFunction((slotIndex) => {
		const h = window.__AUTOGAME_HARNESS_STATE__();
		const card = h?.hand?.[slotIndex];
		return card && !card.activeMinionId && card.id !== 'dungeon_drake';
	}, creatureSlot, { timeout: PASSIVE_DRAW_WAIT_MS });

	const afterRefill = await readHarness(page);
	console.log('hand after passive draw:', JSON.stringify(afterRefill.hand[creatureSlot]));

	await screenshotHand(page, '05-slot-refilled-after-passive-draw');

	await browser.close();
	console.log('Creature burndown Playwright verification passed');
	console.log(`Screenshots saved under ${OUT_DIR}`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
