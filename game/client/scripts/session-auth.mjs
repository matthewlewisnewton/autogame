/** Shared session-cookie auth helpers for Playwright smoke scripts and Node socket tests. */

export const SESSION_COOKIE_NAME = 'ag_session';
const DEFAULT_PASSWORD = 'password123';

export function extractSessionTokenFromResponse(res) {
	const setCookies = typeof res.headers.getSetCookie === 'function'
		? res.headers.getSetCookie()
		: [res.headers.get('set-cookie')].filter(Boolean);

	for (const cookie of setCookies) {
		const prefix = `${SESSION_COOKIE_NAME}=`;
		if (cookie.startsWith(prefix)) {
			return cookie.slice(prefix.length).split(';')[0].trim();
		}
	}
	return null;
}

export async function loginSessionCookie(serverUrl, username, password = DEFAULT_PASSWORD) {
	await fetch(`${serverUrl}/api/register`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ username, password }),
	});
	const login = await fetch(`${serverUrl}/api/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ username, password }),
	});
	if (!login.ok) {
		const body = await login.json().catch(() => ({}));
		throw new Error(`login failed for ${username}: ${login.status} ${JSON.stringify(body)}`);
	}
	const sessionToken = extractSessionTokenFromResponse(login);
	if (!sessionToken) {
		throw new Error(`login response missing session cookie for ${username}`);
	}
	return {
		sessionToken,
		cookieHeader: `${SESSION_COOKIE_NAME}=${sessionToken}`,
	};
}

export async function waitForLobbyBrowser(page, timeout = 15000) {
	await page.waitForFunction(() => {
		const browserEl = document.getElementById('lobby-browser');
		const auth = document.getElementById('auth-overlay');
		return browserEl && !browserEl.classList.contains('hidden')
			&& auth && auth.classList.contains('hidden');
	}, { timeout });
}

/** Register/login in-page so the Vite proxy sets the httpOnly session cookie, then reload. */
export async function loginInBrowser(page, clientUrl, username, password = DEFAULT_PASSWORD) {
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
	await waitForLobbyBrowser(page);
}
