import { chromium } from '@playwright/test';

const url = process.argv[2] ?? process.env.VERIFY_URL ?? 'http://127.0.0.1:8080';
const executablePath = process.env.PLAYWRIGHT_CHROME_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const browser = await chromium.launch({ executablePath });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const consoleErrors = [];
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});

await page.goto(url);
await page.waitForLoadState('networkidle');
const diagnostic = await page.evaluate(() => ({
  href: window.location.href,
  title: document.title,
  bodyStart: document.body?.innerHTML.slice(0, 300) ?? '',
  hasScene: Boolean(document.querySelector('#scene'))
}));
console.log(JSON.stringify({ diagnostic }, null, 2));
await page.waitForSelector('#scene');
await page.waitForTimeout(1200);

const stats = await page.locator('#scene').evaluate((node) => {
  const canvas = node;
  const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
  if (!context) return { litPixels: -1, width: canvas.width, height: canvas.height };
  const width = Math.min(canvas.width, 360);
  const height = Math.min(canvas.height, 260);
  const data = new Uint8Array(width * height * 4);
  const startX = Math.floor((canvas.width - width) / 2);
  const startY = Math.floor((canvas.height - height) / 2);
  context.readPixels(startX, startY, width, height, context.RGBA, context.UNSIGNED_BYTE, data);
  let litPixels = 0;
  for (let index = 0; index < data.length; index += 4) {
    if (data[index] + data[index + 1] + data[index + 2] > 40) litPixels += 1;
  }
  return { litPixels, width: canvas.width, height: canvas.height };
});

await page.screenshot({ path: 'test-results/final-output.png', fullPage: true });
await browser.close();

if (consoleErrors.length > 0) {
  throw new Error(`Console errors: ${consoleErrors.join('\\n')}`);
}

if (stats.width <= 300 || stats.height <= 300 || stats.litPixels <= 500) {
  throw new Error(`Canvas failed nonblank check: ${JSON.stringify(stats)}`);
}

console.log(JSON.stringify({ ok: true, stats }, null, 2));
