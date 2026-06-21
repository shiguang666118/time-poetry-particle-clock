import { expect, test } from '@playwright/test';

test('renders nonblank animated particle watch canvas', async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const canvas = page.locator('#scene');
  await expect(canvas).toBeVisible();
  const viewport = page.viewportSize() ?? { width: 1440, height: 1000 };
  await page.mouse.move(viewport.width * 0.42, viewport.height * 0.68);
  await page.mouse.down();
  await page.mouse.move(viewport.width * 0.72, viewport.height * 0.78, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('#app')).toHaveClass(/is-pointing/);
  await page.keyboard.press('Space');
  await page.keyboard.press('KeyR');
  await page.mouse.wheel(0, -240);
  await page.waitForTimeout(1200);

  const pixelStats = await canvas.evaluate((node) => {
    const canvasElement = node as HTMLCanvasElement;
    const context = canvasElement.getContext('webgl2') ?? canvasElement.getContext('webgl');
    if (!context) {
      return { litPixels: -1, width: canvasElement.width, height: canvasElement.height };
    }
    const width = Math.min(canvasElement.width, 360);
    const height = Math.min(canvasElement.height, 260);
    const startX = Math.floor((canvasElement.width - width) / 2);
    const startY = Math.floor((canvasElement.height - height) / 2);
    const data = new Uint8Array(width * height * 4);
    context.readPixels(startX, startY, width, height, context.RGBA, context.UNSIGNED_BYTE, data);
    let litPixels = 0;
    for (let index = 0; index < data.length; index += 4) {
      if (data[index] + data[index + 1] + data[index + 2] > 40) {
        litPixels += 1;
      }
    }
    return { litPixels, width: canvasElement.width, height: canvasElement.height };
  });

  expect(pixelStats.width).toBeGreaterThan(300);
  expect(pixelStats.height).toBeGreaterThan(300);
  expect(pixelStats.litPixels).toBeGreaterThan(500);
  expect(consoleErrors).toEqual([]);

  await page.screenshot({
    path: testInfo.outputPath(`particle-watch-${testInfo.project.name}.png`),
    fullPage: true
  });
});

test('pointer movement drives the particle rupture interaction', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);

  const canvas = page.locator('#scene');
  await expect(canvas).toBeVisible();
  const viewport = page.viewportSize() ?? { width: 1440, height: 1000 };
  const before = await canvas.evaluate((node) => {
    const canvasElement = node as HTMLCanvasElement;
    const context = canvasElement.getContext('webgl2') ?? canvasElement.getContext('webgl');
    if (!context) return { litPixels: -1, brightPixels: -1 };
    const width = Math.floor(canvasElement.width * 0.35);
    const height = Math.floor(canvasElement.height * 0.52);
    const startX = Math.floor(canvasElement.width * 0.62);
    const startY = Math.floor(canvasElement.height * 0.02);
    const data = new Uint8Array(width * height * 4);
    context.readPixels(startX, startY, width, height, context.RGBA, context.UNSIGNED_BYTE, data);
    let litPixels = 0;
    let brightPixels = 0;
    for (let index = 0; index < data.length; index += 4) {
      const sum = data[index] + data[index + 1] + data[index + 2];
      if (sum > 40) litPixels += 1;
      if (sum > 300) brightPixels += 1;
    }
    return { litPixels, brightPixels };
  });

  await page.mouse.move(viewport.width * 0.67, viewport.height * 0.5);
  await page.waitForTimeout(1000);

  const after = await canvas.evaluate((node) => {
    const canvasElement = node as HTMLCanvasElement;
    const context = canvasElement.getContext('webgl2') ?? canvasElement.getContext('webgl');
    if (!context) return { litPixels: -1, brightPixels: -1 };
    const width = Math.floor(canvasElement.width * 0.35);
    const height = Math.floor(canvasElement.height * 0.52);
    const startX = Math.floor(canvasElement.width * 0.62);
    const startY = Math.floor(canvasElement.height * 0.02);
    const data = new Uint8Array(width * height * 4);
    context.readPixels(startX, startY, width, height, context.RGBA, context.UNSIGNED_BYTE, data);
    let litPixels = 0;
    let brightPixels = 0;
    for (let index = 0; index < data.length; index += 4) {
      const sum = data[index] + data[index + 1] + data[index + 2];
      if (sum > 40) litPixels += 1;
      if (sum > 300) brightPixels += 1;
    }
    return { litPixels, brightPixels };
  });

  await page.screenshot({
    path: testInfo.outputPath(`particle-watch-pointer-void-${testInfo.project.name}.png`),
    fullPage: true
  });

  if (testInfo.project.name === 'desktop') {
    expect(before.brightPixels).toBeGreaterThan(300);
    expect(after.brightPixels).toBeGreaterThan(before.brightPixels + 500);
  } else {
    expect(Math.abs(after.litPixels - before.litPixels)).toBeGreaterThan(500);
  }
});
