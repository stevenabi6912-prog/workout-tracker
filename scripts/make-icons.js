// Renders public/icons/icon.svg to the PNG sizes the manifest and iOS need.
// Needs Playwright (npx playwright install chromium, or point PLAYWRIGHT_MODULE at an
// existing install). Run once and commit the PNGs; the build does not need this.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

const svg = readFileSync(resolve('public/icons/icon.svg'), 'utf8');
const targets = [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['apple-touch-icon.png', 180, true],
  ['icon-maskable-512.png', 512, true],
];

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage();
for (const [name, size, flat] of targets) {
  // Maskable and iOS icons should fill the square; the others keep rounded corners.
  const body = flat ? svg.replace('rx="112"', 'rx="0"') : svg;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${body.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  const buf = await page.screenshot({ omitBackground: !flat, clip: { x: 0, y: 0, width: size, height: size } });
  writeFileSync(resolve('public/icons', name), buf);
  console.log('wrote', name);
}
await browser.close();
