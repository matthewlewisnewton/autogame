import { defineConfig, loadEnv } from 'vite';

// The backend port is fixed at 3000 in normal local dev, but each parallel
// harness worker runs its game server on its OWN allocated port (passed as
// HARNESS_GAME_PORT). Resolve the target when Vite starts so non-default
// workers never proxy /api + /socket.io to the wrong host.
export function resolveGameServerProxyTarget(
	env = process.env,
	mode = 'development',
	loadedEnv
) {
	const loaded = loadedEnv ?? loadEnv(mode, process.cwd(), '');
	// Subprocess env (harness) wins over .env files so parallel workers never
	// inherit a stale PORT from disk.
	const port =
		env.HARNESS_GAME_PORT ||
		loaded.HARNESS_GAME_PORT ||
		env.PORT ||
		loaded.PORT ||
		'3000';
	// 127.0.0.1 avoids localhost → ::1 resolution mismatches in the dev proxy.
	return `http://127.0.0.1:${port}`;
}

export function isHarnessCapture(env = process.env, loadedEnv = {}) {
	return Boolean(env.HARNESS_GAME_PORT || loadedEnv.HARNESS_GAME_PORT);
}

export async function waitForGameServerReady(
	target,
	{ timeoutMs = 90000, intervalMs = 200, fetchImpl = globalThis.fetch } = {}
) {
	const url = `${target}/healthz`;
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		try {
			const res = await fetchImpl(url, { signal: AbortSignal.timeout(1000) });
			if (res.ok) {
				const body = await res.json().catch(() => null);
				if (body?.ok === true) return true;
			}
		} catch {
			// Backend still booting or not yet listening.
		}
		await new Promise((resolve) => setTimeout(resolve, intervalMs));
	}
	return false;
}

export default defineConfig(async ({ mode }) => {
	const loadedEnv = loadEnv(mode, process.cwd(), '');
	const apiTarget = resolveGameServerProxyTarget(process.env, mode, loadedEnv);
	const harnessCapture = isHarnessCapture(process.env, loadedEnv);

	const proxy = {
		'/socket.io': {
			target: apiTarget,
			ws: true,
			changeOrigin: true,
		},
		'/api': {
			target: apiTarget,
			changeOrigin: true,
		},
	};

	if (harnessCapture) {
		proxy['/healthz'] = {
			target: apiTarget,
			changeOrigin: true,
		};
	}

	return {
		// Serve files under public/ at the web root (e.g. public/models/*.glb is
		// reachable at /models/*.glb). Explicit so model assets are served statically.
		publicDir: 'public',
		plugins: [
			{
				name: 'game-server-proxy-readiness',
				async configureServer() {
					console.log(`[vite] Proxying /api and /socket.io → ${apiTarget}`);
					if (harnessCapture) {
						const ready = await waitForGameServerReady(apiTarget);
						if (ready) {
							console.log(`[vite] Game server ready at ${apiTarget}`);
						} else {
							console.warn(
								`[vite] Timed out waiting for game server at ${apiTarget}/healthz`
							);
						}
					}
				},
			},
		],
		server: {
			port: 5173,
			strictPort: true,
			proxy,
		},
	};
});
