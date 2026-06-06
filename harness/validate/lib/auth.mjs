/**
 * JWT register/login and browser token injection for harness validation.
 */

/**
 * Register a user; falls back to login if the username already exists.
 * @returns {Promise<string>} JWT token
 */
export async function registerUser(serverUrl, username, password) {
	const res = await fetch(`${serverUrl}/api/register`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ username, password }),
	});
	const body = await res.json();
	if (body.token) return body.token;

	const login = await fetch(`${serverUrl}/api/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ username, password }),
	});
	const loginBody = await login.json();
	if (!loginBody.token) {
		throw new Error(`Auth failed for ${username}: ${loginBody.error || login.status}`);
	}
	return loginBody.token;
}

/**
 * Inject JWT into localStorage, reload, and wait until authenticated + connected.
 */
export async function injectToken(page, token, clientUrl) {
	await page.goto(clientUrl);
	await page.evaluate((t) => localStorage.setItem('autogame_token', t), token);
	await page.reload();

	await page.waitForFunction(() => {
		const authOverlay = document.querySelector('#auth-overlay');
		const authHidden = authOverlay && authOverlay.classList.contains('hidden');
		if (!authHidden) return false;
		if (typeof window.__isSocketReady === 'function' && window.__isSocketReady()) return true;
		const status = document.querySelector('#status');
		const statusText = status ? status.innerText : '';
		if (statusText.includes('Connected')) return true;
		// After the first heartbeat the status label switches to latency.
		if (/Latency:\s*\d+ms/.test(statusText)) return true;
		return false;
	}, { timeout: 15000 }).catch(async () => {
		const state = await page.evaluate(() => ({
			statusText: document.querySelector('#status')?.innerText,
			authHidden: document.querySelector('#auth-overlay')?.classList.contains('hidden'),
			socketReady: typeof window.__isSocketReady === 'function' ? window.__isSocketReady() : null,
			authError: document.getElementById('login-error')?.textContent,
		}));
		throw new Error(`Socket/auth not ready after token inject: ${JSON.stringify(state)}`);
	});
}

/** @param {import('playwright').Page} page */
export async function isSocketConnected(page) {
	return page.evaluate(() => {
		if (typeof window.__isSocketReady === 'function' && window.__isSocketReady()) return true;
		const statusText = document.querySelector('#status')?.innerText ?? '';
		return statusText.includes('Connected') || /Latency:\s*\d+ms/.test(statusText);
	});
}
