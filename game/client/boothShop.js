// ── Hub Shop Booth — open the card shop via booth:action ──

import { createBoothModule } from './boothCommon.js';

const booth = createBoothModule({ boothId: 'shop', tab: 'shop', renderDepKey: 'renderCardShop' });

export const shouldOpenDebugShopBooth = booth.shouldOpenDebug;
export const openShopBooth = booth.openBooth;
export const registerShopBoothListener = booth.registerBoothListener;

/** @param {{ param: string | null, hostname: string, openShopBooth: typeof openShopBooth, deps: Parameters<typeof openShopBooth>[0] }} options */
export function createRequestDebugShopBoothOpener({ param, hostname, openShopBooth: openFn, deps }) {
	return booth.createRequestDebugOpener({ param, hostname, openFn, deps });
}
