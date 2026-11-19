// /kit checks.
//   node lab/serve.mjs . 4178
//   PLAYWRIGHT=<path to playwright-core> AXE=<path to axe-core/axe.min.js> node lab/kit-check.mjs chromium|webkit [port]
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium, webkit } = require(process.env.PLAYWRIGHT || 'playwright-core');
const axeSrc = fs.readFileSync(process.env.AXE || require.resolve('axe-core/axe.min.js'), 'utf8');
const engine = process.argv[2] || 'chromium';
const port = process.argv[3] || '4178';
const LOCAL = `http://localhost:${port}`;
const L = LOCAL + '/kit';
/* Other hosts are answered from the local server before DNS or TLS, so the page sees the real hostname. */
const PROD = 'https://mainlykavi.com';
const VPREVIEW = 'https://linkforest-git-feature-media-kit-glass-kavi-s-org.vercel.app';
const browser = engine === 'webkit' ? await webkit.launch() : await chromium.launch({ channel: 'chrome' });
let failures = 0;
const ok = (name, cond, detail = '') => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (detail && !cond ? '  [' + detail + ']' : '')); if (!cond) failures++; };
const STUBS = () => {
  window.__copied = null;
  Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: t => { window.__copied = t; return Promise.resolve(); } }, configurable: true });
};
async function page(o = {}) {
  const ctx = await browser.newContext({ viewport: { width: o.w || 1440, height: o.h || 900 }, reducedMotion: o.reduced ? 'reduce' : 'no-preference' });
  await ctx.route(/plausible.io|_vercel|fonts\.g/, r => r.fulfill({ status: 204, body: '' }));
  if (o.host) await ctx.route(o.host + '/**', async r => { const u = new URL(r.request().url()); await r.fulfill({ response: await r.fetch({ url: LOCAL + u.pathname + u.search }) }); });
  await ctx.addInitScript(STUBS);
  const p = await ctx.newPage(); p.errs = [];
  p.on('pageerror', e => p.errs.push('PAGEERROR ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/plausible|_vercel|favicon|fonts|404/i.test(m.text())) p.errs.push(m.text()); });
  return p;
}

// ---------- local (placeholders on) ----------
{
  const p = await page();
  await p.goto(L); await p.waitForTimeout(1200);
  const r = await p.evaluate(() => {
    const acc = sel => [...document.querySelectorAll(sel)].filter(n => !n.closest('[aria-hidden="true"]'));
    const groups = id => [...document.querySelectorAll(`#${id} > .loop-group`)].map(g => [g.getBoundingClientRect().width, g.getBoundingClientRect().height]);
    return {
      railLabel: document.querySelector('.rail-label').textContent, noteShown: !document.getElementById('brandsNote').hidden,
      brandsAcc: acc('#brandTrack .brand').length, brandsAll: document.querySelectorAll('#brandTrack .brand').length,
      clipsAcc: acc('#stripTrack .clip').length, clipsAll: document.querySelectorAll('#stripTrack .clip').length,
      stripGroups: groups('stripTrack'), railGroups: groups('brandTrack'),
      silentFocusable: [...document.querySelectorAll('.loop [aria-hidden="true"] a, .loop [aria-hidden="true"] button')].filter(n => n.tabIndex >= 0).length,
      stripAnim: getComputedStyle(document.getElementById('stripTrack')).animationName,
      railAnim: getComputedStyle(document.getElementById('brandTrack')).animationName,
      workLink: !!document.querySelector('[data-work-link]'),
      portrait: (i => i.complete && i.naturalWidth)(document.querySelector('.portrait img')),
    };
  });
  ok('rail: placeholder label + honest note', r.railLabel === 'Brand slots' && r.noteShown, r.railLabel);
  ok('rail: 10 announced names, copies silent', r.brandsAcc === 10 && r.brandsAll === 40, `${r.brandsAcc}/${r.brandsAll}`);
  ok('rail: vertical loop on desktop, groups equal (seamless)', r.railAnim === 'loop-y' && Math.abs(r.railGroups[0][1] - r.railGroups[1][1]) < 0.5, JSON.stringify(r.railGroups));
  ok('strip: 3 announced clips, copies silent', r.clipsAcc === 3 && r.clipsAll === 18, `${r.clipsAcc}/${r.clipsAll}`);
  ok('strip: groups equal width (seamless) and wider than viewport', Math.abs(r.stripGroups[0][0] - r.stripGroups[1][0]) < 0.5 && r.stripGroups[0][0] > 1440, JSON.stringify(r.stripGroups));
  ok('strip: animating', r.stripAnim === 'loop-x', r.stripAnim);
  ok('silent copies not keyboard-focusable', r.silentFocusable === 0, String(r.silentFocusable));
  ok('hero: "View selected work" present when work exists', r.workLink);
  ok('hero: portrait loaded', r.portrait === 1080, String(r.portrait));

  // hover pauses the strip
  await p.locator('#work').scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
  const sb = await p.locator('.strip').boundingBox();
  await p.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2); await p.waitForTimeout(100);
  ok('strip: hover pauses', await p.$eval('#stripTrack', n => getComputedStyle(n).animationPlayState) === 'paused');
  await p.mouse.move(5, 5);

  // motion toggle pauses everything
  await p.click('.motion-toggle');
  ok('motion toggle pauses rail + strip', await p.evaluate(() => ['stripTrack', 'brandTrack'].every(id => getComputedStyle(document.getElementById(id)).animationPlayState === 'paused')) && (await p.textContent('.motion-toggle span')) === 'Play motion');
  await p.click('.motion-toggle');

  // copy link (hero)
  await p.evaluate(() => scrollTo({ top: 0, behavior: 'instant' })); await p.waitForTimeout(200);
  await p.click('[data-copy-link]'); await p.waitForTimeout(250);
  ok('copy link: canonical URL + "Copied"', await p.evaluate(() => window.__copied) === 'https://mainlykavi.com/kit' && (await p.textContent('[data-copy-link] span')) === 'Copied');
  ok('copy link: toast', await p.$eval('.toast', n => n.classList.contains('show') && /Link copied/.test(n.textContent)));
  await p.evaluate(() => { navigator.clipboard.writeText = () => Promise.reject(new Error('denied')); document.execCommand = () => false; });
  await p.waitForTimeout(600); // let any smooth scroll from the previous click settle
  const y0 = await p.evaluate(() => scrollY);
  await p.click('[data-copy-link]'); await p.waitForTimeout(250);
  ok('copy link failure: toast shows link, page does not jump', await p.$eval('.toast', n => /mainlykavi\.com\/kit/.test(n.textContent)) && Math.abs(await p.evaluate(() => scrollY) - y0) < 2 && await p.$eval('#shareFallback', n => n.hidden));
  // share button keeps its fallback field
  await p.click('#shareBtn'); await p.waitForTimeout(300);
  ok('share failure: selectable link field (unchanged behaviour)', await p.isVisible('#shareFallback') && await p.evaluate(() => document.activeElement.id === 'shareUrl'));

  // player dialog
  const pl = await p.evaluate(async () => {
    const g = document.querySelector('#stripTrack .loop-group');
    g.insertAdjacentHTML('afterbegin', '<li class="clip"><button class="clip-frame" type="button" data-video="/assets/kit/none.mp4" data-poster="" data-title="T" aria-label="Play T" id="tclip"></button></li>');
    document.getElementById('tclip').click();
    const d = document.getElementById('player'); const open = d.open && d.matches(':modal');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    d.querySelector('[data-close-player]').click(); await new Promise(r => setTimeout(r, 50));
    const closed = !d.open && !d.querySelector('video').getAttribute('src');
    document.getElementById('tclip').closest('li').remove();
    return { open, closed };
  });
  ok('player: opens modal, closes and unloads', pl.open && pl.closed, JSON.stringify(pl));

  await p.evaluate(() => scrollTo({ top: 1800, behavior: 'instant' })); await p.waitForTimeout(900);
  ok('dock shows after hero', await p.$eval('#dock', n => !n.hidden && !n.classList.contains('is-away')));
  ok('no page errors (local)', p.errs.length === 0, p.errs.join(' | '));
  await p.context().close();
}

// ---------- Liquid Glass: the homepage's material, not a copy ----------
{
  const p = await page();
  const look = () => p.evaluate(() => {
    const bf = (n, pseudo) => { if (!n) return null; const cs = getComputedStyle(n, pseudo); return cs.backdropFilter || cs.webkitBackdropFilter || ''; };
    return {
      sheets: [...document.querySelectorAll('link[rel="stylesheet"]')].map(l => l.getAttribute('href')).filter(h => /liquid-glass/.test(h)),
      optics: !!document.querySelector('script[src*="liquid-glass-optics"]'),
      calm: document.documentElement.getAttribute('data-glass'),
      panel: bf(document.querySelector('.offer, .menu-panel')),       // .lg-static
      control: bf(document.querySelector('.cta-glass, .home-btn'), '::before'), // interactive .lg
      frost: getComputedStyle(document.querySelector('.cta-glass, .home-btn')).getPropertyValue('--g-frost').trim(),
    };
  });
  await p.goto(LOCAL + '/'); await p.waitForTimeout(400); const home = await look();
  await p.goto(L); await p.waitForTimeout(400); const kit = await look();
  ok('glass: kit loads the homepage stylesheet only (liquid-glass.css, no old material, no optics)', JSON.stringify(kit.sheets) === '["/liquid-glass.css"]' && !kit.optics && JSON.stringify(home.sheets) === '["/liquid-glass.css"]', JSON.stringify({ kit, home }));
  ok('glass: kit moves like the homepage (data-glass="liquid")', kit.calm === 'liquid' && home.calm === 'liquid');
  ok('glass: kit panels = homepage panels (same backdrop)', !!kit.panel && kit.panel === home.panel, `${kit.panel} vs ${home.panel}`);
  ok('glass: kit buttons = homepage buttons (same frost, blurred backdrop)', kit.frost === home.frost && /blur\(3px\)/.test(kit.control), `${kit.frost}/${home.frost} ${kit.control}`);
  ok('no page errors (glass)', p.errs.length === 0, p.errs.join(' | '));
  await p.context().close();
}

// ---------- no horizontal overflow ----------
for (const [w, h] of [[375, 812], [768, 1024], [1024, 768], [1440, 900]]) {
  const p = await page({ w, h });
  await p.goto(L); await p.waitForTimeout(900);
  const sw = await p.evaluate(() => document.documentElement.scrollWidth);
  const layout = await p.evaluate(() => getComputedStyle(document.getElementById('brandTrack')).animationName);
  ok(`no sideways scroll at ${w}px (rail ${layout})`, sw <= w, `${sw}`);
  await p.context().close();
}

// ---------- reduced motion ----------
{
  const p = await page({ reduced: true, w: 390, h: 844 });
  await p.goto(L); await p.waitForTimeout(800);
  const r = await p.evaluate(() => ({
    running: document.getAnimations().filter(a => a.playState === 'running').length,
    clips: [...document.querySelectorAll('#stripTrack .clip')].filter(n => n.offsetParent).length,
    brands: [...document.querySelectorAll('#brandTrack .brand')].filter(n => n.offsetParent).length,
    toggles: [...document.querySelectorAll('[data-motion-toggle]')].filter(n => n.offsetParent).length,
    stripScroll: (s => s.scrollWidth > s.clientWidth && getComputedStyle(s).overflowX === 'auto')(document.querySelector('.strip')),
    opacity: getComputedStyle(document.querySelector('.name')).opacity,
  }));
  ok('reduced motion: nothing animating, one copy of each, swipeable strip, toggles hidden', r.running === 0 && r.clips === 3 && r.brands === 10 && r.toggles === 0 && r.stripScroll && r.opacity === '1', JSON.stringify(r));
  await p.context().close();
}

// ---------- deployed hosts: placeholder brands on a Vercel preview, nothing placeholder in production ----------
const hostState = p => p.evaluate(() => ({
  preview: document.documentElement.classList.contains('is-preview'),
  workHidden: document.getElementById('work').hidden, workLink: !!document.querySelector('[data-work-link]'),
  devTags: document.querySelectorAll('.dev-tag').length,
  rail: !document.getElementById('brands').hidden, label: document.querySelector('.rail-label').textContent,
  note: !document.getElementById('brandsNote').hidden, brands: document.querySelectorAll('#brandTrack .brand').length,
}));
{
  const p = await page({ host: PROD });
  await p.goto(PROD + '/kit'); await p.waitForTimeout(1200);
  const r = await hostState(p);
  ok('production (mainlykavi.com): no placeholder brands, no placeholder work, no dev tags', !r.preview && !r.rail && r.brands === 0 && r.workHidden && !r.workLink && r.devTags === 0, JSON.stringify(r));
  ok('no page errors (production)', p.errs.length === 0, p.errs.join(' | '));
  await p.context().close();
}
{
  const p = await page({ host: VPREVIEW });
  await p.goto(VPREVIEW + '/kit'); await p.waitForTimeout(1200);
  const r = await hostState(p);
  ok('Vercel preview: placeholder brands shown, labelled as placeholders', r.rail && r.label === 'Brand slots' && r.note && r.brands > 0, JSON.stringify(r));
  ok('Vercel preview: other placeholders still localhost-only (work hidden, no dev tags)', !r.preview && r.workHidden && !r.workLink && r.devTags === 0, JSON.stringify(r));
  ok('no page errors (Vercel preview)', p.errs.length === 0, p.errs.join(' | '));
  await p.context().close();
}

// ---------- axe ----------
if (engine === 'chromium') for (const [w, h] of [[390, 844], [1440, 900]]) {
  const p = await page({ reduced: true, w, h });
  await p.goto(L); await p.waitForTimeout(700);
  await p.addScriptTag({ content: axeSrc });
  const v = await p.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } }))
    .violations.map(x => `${x.id}(${x.impact}): ${x.nodes.slice(0, 3).map(n => n.target.join(' ')).join(', ')}`));
  ok(`axe @${w}: 0 violations`, v.length === 0, v.join(' | '));
  await p.context().close();
}

await browser.close();
console.log(failures ? `\n${failures} FAILED` : '\nALL PASS');
process.exit(failures ? 1 : 0);
