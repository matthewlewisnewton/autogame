// ── Hub Deck Booth — open the loadout editor via booth:action ──

import { createBoothModule } from './boothCommon.js';

const booth = createBoothModule({ boothId: 'deck', tab: 'deck', renderDepKey: 'renderDeckEditor' });

export const shouldOpenDebugBooth = booth.shouldOpenDebug;
export const openDeckBooth = booth.openBooth;
export const registerDeckBoothListener = booth.registerBoothListener;

/** @param {{ param: string | null, hostname: string, openDeckBooth: typeof openDeckBooth, deps: Parameters<typeof openDeckBooth>[0] }} options */
export function createRequestDebugBoothOpener({ param, hostname, openDeckBooth: openFn, deps }) {
	return booth.createRequestDebugOpener({ param, hostname, openFn, deps });
}
