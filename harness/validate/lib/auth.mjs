/**
 * Session-cookie auth helpers for harness validation playthroughs.
 */

/** @param {import('playwright').Page} page */
export async function isSocketConnected(page) {
	return page.evaluate(() => {
		if (typeof window.__isSocketReady === 'function' && window.__isSocketReady()) return true;
		const statusText = document.querySelector('#status')?.innerText ?? '';
		return statusText.includes('Connected') || /Latency:\s*\d+ms/.test(statusText);
	});
}

export async function waitForLobbyBrowser(page, timeout = 15000) {
	await page.waitForFunction(() => {
		const browserEl = document.getElementById('lobby-browser');
		const auth = document.getElementById('auth-overlay');
		return browserEl && !browserEl.classList.contains('hidden')
			&& auth && auth.classList.contains('hidden');
	}, { timeout }).catch(async () => {
		const state = await page.evaluate(() => ({
			lobbyBrowserHidden: document.querySelector('#lobby-browser')?.classList.contains('hidden'),
			authHidden: document.querySelector('#auth-overlay')?.classList.contains('hidden'),
			statusText: document.querySelector('#status')?.innerText,
		}));
		throw new Error(`#lobby-browser not visible: ${JSON.stringify(state)}`);
	});
}

async function waitForAuthAndSocket(page, timeout = 15000) {
	await page.waitForFunction(() => {
		const authOverlay = document.querySelector('#auth-overlay');
		const authHidden = authOverlay && authOverlay.classList.contains('hidden');
		if (!authHidden) return false;
		if (typeof window.__isSocketReady === 'function' && window.__isSocketReady()) return true;
		const status = document.querySelector('#status');
		const statusText = status ? status.innerText : '';
		if (statusText.includes('Connected')) return true;
		if (/Latency:\s*\d+ms/.test(statusText)) return true;
		return false;
	}, { timeout }).catch(async () => {
		const state = await page.evaluate(() => ({
			statusText: document.querySelector('#status')?.innerText,
			authHidden: document.querySelector('#auth-overlay')?.classList.contains('hidden'),
			socketReady: typeof window.__isSocketReady === 'function' ? window.__isSocketReady() : null,
			authError: document.getElementById('login-error')?.textContent,
		}));
		throw new Error(`Socket/auth not ready after session login: ${JSON.stringify(state)}`);
	});
}

/** Register/login in-page so the Vite proxy sets the httpOnly session cookie, then reload. */
export async function loginInBrowser(page, clientUrl, username, password) {
	await page.goto(clientUrl);
	await page.evaluate(async ({ username, password }) => {
		await fetch('/api/register', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify({ username, password }),
		});
		const login = await fetch('/api/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify({ username, password }),
		});
		if (!login.ok) {
			const body = await login.json().catch(() => ({}));
			throw new Error(`login failed: ${login.status} ${JSON.stringify(body)}`);
		}
	}, { username, password });
	await page.reload();
	await waitForAuthAndSocket(page);
	await waitForLobbyBrowser(page);
}
