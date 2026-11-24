// Screenshots of /dev/stage states, for looking at layouts by eye.
//   node scripts/stage-shot.mjs <out-dir> <WxH> "<query>" [<WxH> "<query>" …]
// Needs the dev server (npx vite --port 3120 --strictPort) and a local Chrome or Edge.
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { launchBrowser, BASE } from './fit-check.mjs';

const [outDir, ...pairs] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const browser = await launchBrowser();
const page = await browser.newPage();
await page.emulateMedia({ reducedMotion: 'reduce' });
for (let index = 0; index < pairs.length; index += 2) {
  const [width, height] = pairs[index].split('x').map(Number);
  const query = pairs[index + 1];
  await page.setViewportSize({ width, height });
  await page.goto(`${BASE}/dev/stage?bare=1&${query}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  const file = path.join(outDir, `${width}x${height}-${query.replace(/[^a-z0-9=]+/gi, '_')}.png`);
  await page.screenshot({ path: file });
  console.log(file);
}
await browser.close();
