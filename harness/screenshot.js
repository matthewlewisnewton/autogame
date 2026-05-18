const { chromium } = require('playwright');

(async () => {
  const url = process.argv[2] || 'http://localhost:5173';
  const output = process.argv[3] || 'screenshot.png';

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
  // Give the 3D scene a moment to render
  await page.waitForTimeout(3000);
  await page.screenshot({ path: output, fullPage: false });

  console.log(`Screenshot saved to ${output}`);
  await browser.close();
})();
