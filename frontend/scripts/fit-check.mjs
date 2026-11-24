// Fit check for the game stage (brief 2.2, criteria G1–G8): loops every viewport of the
// matrix × fixtures × states × roles on /dev/stage and asserts that nothing scrolls,
// nothing is clipped, the tiles / countdown / host action are on screen, type stays above
// its floors, and clamping only happens where the brief allows it.
//
//   npm run fit-check                 (dev server must run: npx vite --port 3120 --strictPort)
//   node scripts/fit-check.mjs --only P1,L1 --filter phase=reveal --motion
//
// Options: --only <viewport ids>, --filter <substring of the query>, --motion (run with
// animations and wait for them instead of prefers-reduced-motion), --workers <n>,
// --out <dir> (screenshots of failures; default FIT_CHECK_OUT or ./fit-check-out).
// Uses playwright-core with the locally installed Chrome (or Edge); no browser download.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

export const BASE = process.env.FIT_CHECK_BASE || 'http://localhost:3120';

const BROWSERS = [
  process.env.FIT_CHECK_BROWSER,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

export async function launchBrowser() {
  const executablePath = BROWSERS.find((file) => existsSync(file));
  if (executablePath) return chromium.launch({ executablePath, headless: true });
  return chromium.launch({ channel: 'chrome', headless: true });
}

// ------------------------------------------------------------------ the matrix

export const VIEWPORTS = {
  P1: [320, 454], P2: [320, 568], P3: [360, 560], P4: [360, 640], P5: [375, 553], P6: [393, 659],
  P7: [393, 730], P8: [393, 852], P9: [412, 780], P10: [412, 915], P11: [430, 739], P12: [430, 932],
  L1: [568, 270], L2: [640, 300], L3: [667, 331], L4: [852, 340], L5: [915, 360], L6: [932, 380],
  T1: [768, 1024], T2: [1024, 768], T3: [820, 1180], T4: [1180, 820],
  D1: [1280, 720], D2: [1366, 650], D3: [1280, 800], D4: [1440, 900], D5: [1920, 1080], D6: [3840, 2160],
};
const BIG_VIEWPORTS = ['T2', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6'];
const FIXTURES = ['short', 'typical', 'long', 'word'];

function states(viewport) {
  const list = [];
  const add = (query) => list.push(query);
  // 1–2. Lobby: host (invite), host in review mode, player; by room size.
  for (const players of [1, 9, 150]) {
    add(`phase=lobby&role=host&players=${players}`);
    add(`phase=lobby&role=player&players=${players}`);
  }
  add('phase=lobby&role=host&players=9&review=1');
  add('phase=lobby&role=host&players=1&solo=1');
  add('phase=lobby&role=player&players=9&host=away');
  // 3–4. Question: every sub-state, every fixture.
  for (const fixture of FIXTURES) {
    for (const sub of ['unanswered', 'sending', 'locked', 'timeup', 'failed']) add(`phase=question&role=host&fixture=${fixture}&sub=${sub}`);
    add(`phase=question&role=player&fixture=${fixture}&players=150`);
    add(`phase=question&role=host&fixture=${fixture}&players=1&solo=1`);
  }
  // 5–6. Reveal: host for correct / wrong / no answer; player waiting, host away, reconnecting.
  for (const fixture of FIXTURES) {
    for (const outcome of ['correct', 'wrong', 'none']) add(`phase=reveal&role=host&fixture=${fixture}&outcome=${outcome}`);
    add(`phase=reveal&role=player&fixture=${fixture}`);
    add(`phase=reveal&role=player&fixture=${fixture}&host=away&outcome=wrong`);
    add(`phase=reveal&role=player&fixture=${fixture}&host=reconnecting&players=150`);
  }
  add('phase=reveal&role=host&fixture=typical&players=1&solo=1');
  add('phase=reveal&role=host&fixture=typical&players=150&last=1');
  add('phase=reveal&role=host&fixture=typical&standin=1');
  // 7. Final: 1, 2, 3, 9, 150 players as demo host signed out, signed-in host, player.
  for (const players of [1, 2, 3, 9, 150]) {
    add(`phase=final&role=host&players=${players}`);
    add(`phase=final&role=host&players=${players}&signed=1`);
    add(`phase=final&role=player&players=${players}`);
  }
  add('phase=final&role=host&players=9&demo=0&signed=1');
  // 8. With the connection banner.
  for (const banner of ['offline', 'reconnecting']) {
    add(`phase=lobby&role=host&players=9&banner=${banner}`);
    add(`phase=lobby&role=player&players=9&banner=${banner}`);
    for (const fixture of FIXTURES) {
      add(`phase=question&role=host&fixture=${fixture}&sub=locked&banner=${banner}`);
      add(`phase=reveal&role=host&fixture=${fixture}&banner=${banner}`);
      add(`phase=reveal&role=player&fixture=${fixture}&players=150&banner=${banner}`);
    }
    for (const players of [1, 3, 150]) {
      add(`phase=final&role=host&players=${players}&banner=${banner}`);
      add(`phase=final&role=player&players=${players}&banner=${banner}`);
    }
  }
  add('phase=question&role=host&fixture=long&banner=restarting');
  // 9. Big screen, host.
  if (BIG_VIEWPORTS.includes(viewport)) {
    for (const players of [9, 150]) add(`phase=lobby&role=host&players=${players}&big=1`);
    for (const fixture of FIXTURES) {
      add(`phase=question&role=host&fixture=${fixture}&big=1&sub=locked`);
      add(`phase=reveal&role=host&fixture=${fixture}&big=1&players=150`);
    }
    for (const players of [1, 3, 9, 150]) add(`phase=final&role=host&players=${players}&big=1`);
  }
  return list;
}

// ---------------------------------------------------------------- in-page checks

// Runs in the page. Returns a list of failure messages for the current state.
function checkPage({ viewport, query }) {
  const failures = [];
  const params = new URLSearchParams(query);
  const phase = params.get('phase');
  const role = params.get('role');
  const fixture = params.get('fixture') || 'typical';
  const W = window.innerWidth;
  const H = window.innerHeight;
  const shell = document.getElementById('game-stage');
  if (!shell) return ['no game shell rendered'];
  const tol = 1;
  const describe = (element) => {
    if (!element) return '(none)';
    const name = element.tagName.toLowerCase();
    const cls = typeof element.className === 'string' ? element.className.split(' ').filter((c) => !/^sc-/.test(c)).slice(0, 2).join('.') : '';
    const text = (element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    return `${name}${cls ? `.${cls}` : ''}${element.dataset.fit ? `[fit=${element.dataset.fit}]` : ''} "${text}"`;
  };
  const isRendered = (element) => {
    if (!element.isConnected) return false;
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 1 || rect.height > 1;
  };
  const insideDecor = (element) => element.closest('[data-confetti], [data-probe], dialog');
  // The visible box of an element after clipping by every overflow-clipping ancestor.
  const clipRect = (element) => {
    let rect = { left: 0, top: 0, right: W, bottom: H };
    for (let node = element.parentElement; node && node !== document.documentElement; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.overflowX !== 'visible' || style.overflowY !== 'visible') {
        const box = node.getBoundingClientRect();
        rect = { left: Math.max(rect.left, box.left), top: Math.max(rect.top, box.top), right: Math.min(rect.right, box.right), bottom: Math.min(rect.bottom, box.bottom) };
      }
    }
    return rect;
  };
  const fullyVisible = (element, label) => {
    if (!element) {
      failures.push(`${label}: missing`);
      return false;
    }
    const box = element.getBoundingClientRect();
    const clip = clipRect(element);
    const ok = box.left >= clip.left - tol && box.top >= clip.top - tol && box.right <= clip.right + tol && box.bottom <= clip.bottom + tol && box.width > 0 && box.height > 0;
    if (!ok) failures.push(`${label}: not fully visible ${Math.round(box.left)},${Math.round(box.top)} ${Math.round(box.width)}×${Math.round(box.height)} (clip ${Math.round(clip.top)}–${Math.round(clip.bottom)})`);
    return ok;
  };

  // G1: the document cannot scroll.
  const root = document.scrollingElement;
  if (root.scrollHeight > H || root.scrollWidth > W) failures.push(`G1: document ${root.scrollWidth}×${root.scrollHeight} > ${W}×${H}`);

  const all = [...shell.querySelectorAll('*')].filter((element) => !insideDecor(element));
  // G2: no clipping element hides content (except clamped / by-design truncated text).
  for (const element of [shell, ...all]) {
    if (!isRendered(element)) continue;
    const style = getComputedStyle(element);
    if (style.overflowX === 'visible' && style.overflowY === 'visible') continue;
    if (element.clientWidth <= 1 && element.clientHeight <= 1) continue; // visually hidden
    if (element.hasAttribute('data-clamped') || element.hasAttribute('data-truncate')) continue;
    const overY = element.scrollHeight - element.clientHeight;
    const overX = element.scrollWidth - element.clientWidth;
    if (overY > 1 || overX > 1) failures.push(`G2: overflow ${overX > 1 ? `x+${overX}` : ''}${overY > 1 ? ` y+${overY}` : ''} in ${describe(element)}`);
  }

  // G2 (visible overflow): text must stay inside its parent box (catches no-wrap text
  // running into a neighbouring column). Absolutely positioned badges are exempt.
  for (const element of all) {
    if (!isRendered(element) || element.closest('.visually-hidden')) continue;
    const ownText = [...element.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim());
    if (!ownText) continue;
    const style = getComputedStyle(element);
    if (style.position === 'absolute' || style.position === 'fixed' || style.display === 'inline') continue;
    const parent = element.parentElement;
    if (!parent || getComputedStyle(parent).display === 'contents') continue;
    const box = element.getBoundingClientRect();
    const outer = parent.getBoundingClientRect();
    if (box.right > outer.right + 2 || box.left < outer.left - 2) failures.push(`G2: text outside its box (${Math.round(box.left)}–${Math.round(box.right)} vs ${Math.round(outer.left)}–${Math.round(outer.right)}) in ${describe(element)}`);
  }

  // G5: type floors.
  const fontOf = (element) => parseFloat(getComputedStyle(element).fontSize);
  for (const element of all) {
    if (!isRendered(element)) continue;
    const ownText = [...element.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim());
    if (!ownText) continue;
    if (element.closest('.visually-hidden')) continue;
    const size = fontOf(element);
    let floor = 12;
    if (element.closest('[data-fit="question"]')) floor = 15;
    else if (element.closest('[data-fit="answer"]') || element.closest('ol li') || element.closest('[role="status"]')) floor = 13;
    if (size < floor - 0.05) failures.push(`G5: ${size.toFixed(1)}px < ${floor}px in ${describe(element)}`);
  }

  // G6: clamping only for F-long (and F-word on the smallest stages); Full text shown then.
  const clamped = [...shell.querySelectorAll('[data-clamped]')].filter((element) => element.matches('[data-fit]'));
  if (clamped.length) {
    const allowed = fixture === 'long' || (fixture === 'word' && ['P1', 'L1'].includes(viewport));
    if (!allowed) failures.push(`G6: clamped with fixture ${fixture}: ${clamped.map(describe).join('; ')}`);
    const full = [...shell.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Full text');
    if (!full || !isRendered(full)) failures.push('G6: text clamped but no "Full text" button');
    else fullyVisible(full, 'G6 Full text button');
  }

  // Tap targets: every visible button in the stage at least 44 px high (48 for the host action).
  for (const button of shell.querySelectorAll('button, a[href]')) {
    if (!isRendered(button) || insideDecor(button)) continue;
    const box = button.getBoundingClientRect();
    if (box.height < 44 - 0.5 || box.width < 44 - 0.5) failures.push(`tap target ${Math.round(box.width)}×${Math.round(box.height)}: ${describe(button)}`);
    fullyVisible(button, `button ${describe(button)}`);
  }

  if (phase === 'question') {
    // G3: four tiles and the countdown on screen, tiles ≥ 44 × 44.
    const tiles = [...shell.querySelectorAll('[role="group"][aria-label="Answers"] > button')];
    if (tiles.length !== 4) failures.push(`G3: ${tiles.length} tiles`);
    tiles.forEach((tile, index) => {
      fullyVisible(tile, `G3 tile ${index + 1}`);
      const box = tile.getBoundingClientRect();
      if (box.height < 44 - 0.5 || box.width < 44 - 0.5) failures.push(`G3: tile ${index + 1} ${Math.round(box.width)}×${Math.round(box.height)}`);
    });
    fullyVisible(shell.querySelector('[data-countdown]'), 'G3 countdown');
    fullyVisible(shell.querySelector('[data-fit="question"]'), 'question');
  }

  // G4: the host's primary action fully on screen, ≥ 48 px.
  if ((phase === 'reveal' || phase === 'lobby') && role === 'host') {
    const labels = phase === 'lobby' ? ['Start game'] : ['Next question', 'Show final results'];
    const button = [...shell.querySelectorAll('button')].find((candidate) => labels.includes(candidate.textContent.trim()));
    if (fullyVisible(button, 'G4 host action')) {
      const box = button.getBoundingClientRect();
      if (box.height < 48 - 0.5) failures.push(`G4: host action ${Math.round(box.height)} px high`);
    }
  }

  // G7: reveal shows the outcome (or the correct answer on Big screen), the correct
  // answer, and the leader and the viewer in the leaderboard.
  if (phase === 'reveal') {
    const outcome = shell.querySelector('h1');
    fullyVisible(outcome, 'G7 outcome');
    fullyVisible(shell.querySelector('[aria-label="Answers"] > [data-state="correct"]'), 'G7 correct answer');
    const rows = [...shell.querySelectorAll('ol[aria-label="Leaderboard"] > li:not([data-probe])')];
    rows.forEach((row, index) => fullyVisible(row, `G7 leaderboard row ${index + 1}`));
    const players = Number(params.get('players') || (params.get('solo') ? 1 : 9));
    const hasLeader = rows.some((row) => row.textContent.trim().startsWith('1'));
    const hasMe = rows.some((row) => row.textContent.includes('(you)'));
    const smallest = viewport === 'P1' && params.get('banner');
    if (!hasMe) failures.push('G7: viewer row missing from the leaderboard');
    if (!hasLeader && !(smallest && hasMe) && players > 1) failures.push(`G7: leader row missing (${rows.length} rows)`);
  }

  // G8: final shows the headline, the whole podium and the actions.
  if (phase === 'final') {
    fullyVisible(shell.querySelector('h1'), 'G8 headline');
    const podium = shell.querySelector('ol[aria-label="Top three"]');
    fullyVisible(podium, 'G8 podium');
    podium?.querySelectorAll('li .pedestal, li .name').forEach((element, index) => fullyVisible(element, `G8 podium part ${index + 1}`));
    const actions = shell.querySelector('[data-actions]');
    fullyVisible(actions, 'G8 actions');
    const players = Number(params.get('players') || 9);
    if (players >= 4) {
      const rows = shell.querySelectorAll('ol[aria-label="Full standings"] > li:not([data-probe])').length;
      const full = [...shell.querySelectorAll('button')].some((button) => button.textContent.trim() === 'Full standings');
      if (rows < players - 3 && !full) failures.push('G8: standings cut without a "Full standings" button');
    }
  }

  return failures;
}

// ---------------------------------------------------------------------- runner

async function settle(page, motion) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  // With motion: past the podium rise (880 ms) and the points count-up (600 ms).
  await page.waitForTimeout(motion ? 1400 : 90);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function runViewport(browser, id, { filter, motion, outDir }) {
  const [width, height] = VIEWPORTS[id];
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: motion ? 'no-preference' : 'reduce' });
  const page = await context.newPage();
  const results = [];
  let loaded = false;
  for (const query of states(id).filter((state) => !filter || filter.every((part) => state.includes(part)))) {
    const url = `/dev/stage?bare=1&${query}`;
    if (!loaded) {
      await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle' });
      loaded = true;
    } else {
      // In-app navigation: no reload, the stage remounts (it is keyed by the query).
      await page.evaluate((next) => {
        window.history.replaceState(null, '', next);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }, url);
    }
    if (motion) await page.evaluate(() => sessionStorage.clear());
    await page.waitForSelector(`#game-stage[data-phase="${new URLSearchParams(query).get('phase')}"]`, { timeout: 5000 });
    await settle(page, motion);
    const failures = await page.evaluate(checkPage, { viewport: id, query });
    if (failures.length && outDir) {
      const file = path.join(outDir, `${id}-${query.replace(/[^a-z0-9=]+/gi, '_')}.png`);
      await page.screenshot({ path: file });
    }
    results.push({ viewport: id, query, failures });
  }
  await context.close();
  return results;
}

async function main() {
  const args = process.argv.slice(2);
  const option = (name) => {
    const index = args.indexOf(`--${name}`);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const only = option('only')?.split(',');
  const filter = option('filter')?.split(',');
  const motion = args.includes('--motion');
  const workers = Number(option('workers') || 6);
  const outDir = path.resolve(option('out') || process.env.FIT_CHECK_OUT || 'fit-check-out');
  mkdirSync(outDir, { recursive: true });

  const ids = Object.keys(VIEWPORTS).filter((id) => !only || only.includes(id));
  const browser = await launchBrowser();
  const results = [];
  const queue = [...ids];
  const started = Date.now();
  await Promise.all(
    Array.from({ length: Math.min(workers, queue.length) }, async () => {
      while (queue.length) {
        const id = queue.shift();
        const viewportResults = await runViewport(browser, id, { filter, motion, outDir });
        const failed = viewportResults.filter((result) => result.failures.length).length;
        console.log(`${id.padEnd(4)} ${VIEWPORTS[id].join('×').padEnd(10)} ${viewportResults.length - failed}/${viewportResults.length} pass`);
        results.push(...viewportResults);
      }
    })
  );
  await browser.close();

  const groups = { 'Portrait phones (P)': /^P/, 'Landscape phones (L)': /^L/, 'Tablets (T)': /^T/, 'Laptops, TVs (D)': /^D/ };
  console.log('\nSummary');
  for (const [name, pattern] of Object.entries(groups)) {
    const group = results.filter((result) => pattern.test(result.viewport));
    if (!group.length) continue;
    const passed = group.filter((result) => !result.failures.length).length;
    console.log(`  ${name.padEnd(22)} ${passed}/${group.length}`);
  }
  const failed = results.filter((result) => result.failures.length);
  for (const result of failed.slice(0, 60)) {
    console.log(`\n✗ ${result.viewport} ${result.query}`);
    for (const message of result.failures.slice(0, 6)) console.log(`    ${message}`);
  }
  if (failed.length > 60) console.log(`\n… and ${failed.length - 60} more failing states`);
  writeFileSync(path.join(outDir, 'results.json'), JSON.stringify(results, null, 2));
  console.log(`\n${results.length - failed.length}/${results.length} states pass in ${Math.round((Date.now() - started) / 1000)} s. Screenshots of failures and results.json: ${outDir}`);
  process.exitCode = failed.length ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
