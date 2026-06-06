#!/usr/bin/env node
/**
 * Headless Playwright playthrough driver for autogame validation.
 *
 *   node harness/validate/playthrough.mjs [--preset rooms] [--out validation/rooms/] [--steps auth]
 *
 * Steps: auth (implemented), hub | boss | full (stubbed for later sub-tickets).
 * Sibling presets for tickets 278–281: add harness/validate/presets/<name>.mjs
 * exporting { questId, questTier, bossType, deployScenario } and pass --preset <name>.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { registerUser, injectToken, isSocketConnected } from './lib/auth.mjs';
import { startGame, stopGame } from './lib/gameProcess.mjs';
import { readHarness } from './lib/harnessState.mjs';
import { writeScreenshot } from './lib/screenshot.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

const PRESET_MODULES = {
	rooms: () => import('./presets/rooms.mjs'),
};

const STUB_STEPS = new Set(['hub', 'boss', 'full']);

function parseArgs(argv) {
	const opts = {
		preset: 'rooms',
		out: 'validation/rooms/',
		steps: 'auth',
	};
	for (let i = 2; i < argv.length; i += 1) {
		const arg = argv[i];
		if (arg === '--preset' && argv[i + 1]) {
			opts.preset = argv[++i];
		} else if (arg === '--out' && argv[i + 1]) {
			opts.out = argv[++i];
		} else if (arg === '--steps' && argv[i + 1]) {
			opts.steps = argv[++i];
		} else if (arg === '--help' || arg === '-h') {
			console.log(`usage: node harness/validate/playthrough.mjs [--preset <name>] [--out <dir>] [--steps auth|hub|boss|full]`);
			process.exit(0);
		} else {
			throw new Error(`Unknown argument: ${arg}`);
		}
	}
	return opts;
}

async function loadPreset(name) {
	const loader = PRESET_MODULES[name];
	if (!loader) throw new Error(`Unknown preset "${name}" — available: ${Object.keys(PRESET_MODULES).join(', ')}`);
	const mod = await loader();
	return mod.default ?? mod;
}

async function waitForLobbyBrowser(page) {
	await page.waitForFunction(() => {
		const el = document.querySelector('#lobby-browser');
		return el && !el.classList.contains('hidden')
			&& window.getComputedStyle(el).display !== 'none';
	}, { timeout: 15000 }).catch(async () => {
		const state = await page.evaluate(() => ({
			lobbyBrowserHidden: document.querySelector('#lobby-browser')?.classList.contains('hidden'),
			authHidden: document.querySelector('#auth-overlay')?.classList.contains('hidden'),
			statusText: document.querySelector('#status')?.innerText,
		}));
		throw new Error(`#lobby-browser not visible: ${JSON.stringify(state)}`);
	});
}

async function runAuthStep({ page, serverUrl, clientUrl, outDirAbs }) {
	const username = `playthrough-${Date.now()}`;
	const password = 'harness-test-password';
	const token = await registerUser(serverUrl, username, password);
	await injectToken(page, token, clientUrl);
	await waitForLobbyBrowser(page);

	const harness = await readHarness(page);
	const connected = await isSocketConnected(page);
	const screenshotPath = await writeScreenshot(page, outDirAbs, '01-lobby-browser');

	return {
		username,
		connected,
		lobbyBrowserVisible: true,
		harnessPhase: harness?.phase ?? null,
		screenshot: path.relative(REPO_ROOT, screenshotPath),
	};
}

async function main() {
	const opts = parseArgs(process.argv);
	const outDirAbs = path.resolve(REPO_ROOT, opts.out);
	fs.mkdirSync(outDirAbs, { recursive: true });

	if (STUB_STEPS.has(opts.steps)) {
		throw new Error(`--steps ${opts.steps} is not implemented yet (sub-tickets 03–05)`);
	}
	if (opts.steps !== 'auth') {
		throw new Error(`Unknown --steps value: ${opts.steps}`);
	}

	const preset = await loadPreset(opts.preset);
	let browser;
	let game;

	try {
		game = await startGame();
		browser = await chromium.launch({ headless: true });
		const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

		const authResult = await runAuthStep({
			page,
			serverUrl: game.serverUrl,
			clientUrl: game.clientUrl,
			outDirAbs,
		});

		const summary = {
			ok: true,
			preset: opts.preset,
			steps: opts.steps,
			outDir: path.relative(REPO_ROOT, outDirAbs),
			serverPort: game.serverPort,
			clientPort: game.clientPort,
			presetConfig: preset,
			auth: authResult,
		};

		const summaryPath = path.join(outDirAbs, 'run-summary.json');
		fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
		console.log(JSON.stringify(summary));
	} finally {
		if (browser) await browser.close().catch(() => {});
		await stopGame();
	}
}

async function shutdown(code) {
	await stopGame();
	process.exit(code);
}

process.on('SIGINT', () => { shutdown(130); });
process.on('SIGTERM', () => { shutdown(143); });

main().catch(async (err) => {
	console.error(`playthrough failed: ${err.message}`);
	await stopGame();
	process.exit(1);
});
