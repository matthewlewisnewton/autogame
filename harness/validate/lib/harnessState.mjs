/**
 * Read window.__AUTOGAME_HARNESS_STATE__() from the browser page.
 */

export async function readHarness(page) {
	return page.evaluate(() => {
		if (typeof window.__AUTOGAME_HARNESS_STATE__ !== 'function') return null;
		return window.__AUTOGAME_HARNESS_STATE__();
	});
}
