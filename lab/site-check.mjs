// Cross-engine checks for every page.
//   node lab/serve.mjs . 4176
//   PLAYWRIGHT=<path to playwright-core> node lab/site-check.mjs firefox|webkit|chromium [port]
//   PREVIEW_URL=<a deployed Vercel preview> adds the deployed-host block.
import { createRequire } from 'node:module';
const { chromium, firefox, webkit } = createRequire(import.meta.url)(process.env.PLAYWRIGHT || 'playwright-core');
const engine = process.argv[2] || 'firefox';
const L = 'http://localhost:' + (process.argv[3] || '4176');
const P = process.env.PREVIEW_URL;
const PROD = 'https://mainlykavi.com'; // answered from the local server before DNS or TLS, so pages see the real hostname
const browserType = { chromium, firefox, webkit }[engine];
const browser = await browserType.launch(engine === 'chromium' ? { channel: 'chrome' } : {});
const results = []; let failures = 0;
const ok = (name, cond, detail = '') => { console.log((cond ? 'PASS ' : 'FAIL ') + name); results.push((cond ? 'PASS ' : 'FAIL ') + name + (detail ? '  [' + detail + ']' : '')); if (!cond) failures++; };

/* clipboard + share stubs: permissions APIs differ per engine, so record writes instead */
const STUBS = () => {
  window.__copied = null;
  Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: t => { window.__copied = t; return Promise.resolve(); } }, configurable: true });
};
async function page(opts = {}) { console.log('  [new context] ' + new Date().toISOString().slice(11,19));
  const ctx = await browser.newContext({ viewport: { width: opts.w || 1280, height: opts.h || 860 }, reducedMotion: opts.reduced ? 'reduce' : 'no-preference' });
  await ctx.route(/plausible.io|_vercel/, (r) => r.fulfill({ status: 204, body: '' })); // analytics requests left open hang context close
  if (opts.host) await ctx.route(opts.host + '/**', async (r) => { const u = new URL(r.request().url()); await r.fulfill({ response: await r.fetch({ url: L + u.pathname + u.search }) }); });
  if (opts.stubs) await ctx.addInitScript(STUBS);
  const p = await ctx.newPage(); p.errs = [];
  p.on('pageerror', e => p.errs.push('PAGEERROR ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/plausible|_vercel|404|Content Security|favicon/i.test(m.text())) p.errs.push(m.text()); });
  return p;
}
const backdrop = (p, sel) => p.$eval(sel, n => { const cs = getComputedStyle(n); return cs.backdropFilter || cs.webkitBackdropFilter || cs.getPropertyValue('-webkit-backdrop-filter') || ''; });
/* what a visitor to /kit sees of the placeholders */
const kitPlaceholders = p => p.evaluate(() => ({
  clips: document.querySelectorAll('.clip').length, placeholderClips: document.querySelectorAll('.clip.is-placeholder').length,
  workHidden: document.getElementById('work').hidden, devTags: document.querySelectorAll('.dev-tag').length,
  rail: !document.getElementById('brands').hidden, label: document.querySelector('.rail-label').textContent,
}));

// ---------- routes + nav ----------
{
  const p = await page();
  for (const [path, code] of [['/', 200], ['/kit', 200], ['/socials', 200], ['/contact', 200], ['/faq', 200], ['/projects', 200], ['/nope-xyz', 404]]) {
    const r = await p.goto(L + path); ok(`route ${path} -> ${code}`, r.status() === code, 'got ' + r.status());
    await p.waitForTimeout(350);
    const links = await p.$$eval('#menuPanel .menu-link', as => as.map(a => a.getAttribute('href')));
    ok(`menu on ${path}: no FAQ/Projects, has kit+contact`, links.length > 0 && !links.some(h => /faq|projects/.test(h)) && links.includes('/kit') && links.includes('/contact'), links.join(' '));
  }
  ok('no page errors (routes)', p.errs.length === 0, p.errs.join(' | '));
  await p.context().close();
}

// ---------- glass path ----------
{
  const p = await page();
  await p.goto(L + '/'); await p.waitForTimeout(600);
  const cls = await p.getAttribute('html', 'class');
  await p.waitForFunction(() => document.querySelectorAll('.lg-gl').length >= 11, null, { timeout: 9000 }).catch(() => {});
  const gl = await p.evaluate(() => ({ gl: document.querySelectorAll('.lg-gl').length, canvases: document.querySelectorAll('.lg-canvas.is-on').length }));
  ok(`glass: ${engine} WebGL material engaged (11 controls, 2 canvases)`, gl.gl === 11 && gl.canvases === 2, JSON.stringify(gl) + ' ' + cls);
  const bf = await p.$eval('.home-btn', n => { const cs = getComputedStyle(n, '::before'); return cs.backdropFilter || cs.webkitBackdropFilter || ''; });
  ok('glass: CSS material underneath has a backdrop blur (fallback)', /blur/.test(bf), bf);
  // springs: hover moves/scales the control
  const btn = p.locator('.home-btn[href="/kit"]'); const b = await btn.boundingBox();
  await p.mouse.move(b.x + b.width * .3, b.y + b.height * .4, { steps: 6 }); await p.waitForTimeout(400);
  const hov = await p.$eval('.home-btn[href="/kit"]', n => ({ cls: n.className, scale: n.style.scale }));
  ok('springs: hover state + scale applied', /is-lg-hovered/.test(hov.cls) && !!hov.scale, JSON.stringify(hov));
  await p.mouse.down(); await p.waitForTimeout(250);
  ok('springs: press state', /is-lg-pressed/.test(await p.getAttribute('.home-btn[href="/kit"]', 'class')));
  await p.mouse.up();
  ok('no page errors (glass)', p.errs.length === 0, p.errs.join(' | '));
  await p.context().close();
}

// ---------- home interactions ----------
{
  const p = await page();
  await p.goto(L + '/'); await p.waitForTimeout(500);
  const t1 = await p.textContent('.tagline-text'); await p.click('#tagline'); await p.waitForTimeout(450);
  ok('home: tagline shuffles', t1 !== await p.textContent('.tagline-text'));
  await p.click('#themeToggle'); await p.waitForTimeout(200);
  ok('home: dark theme toggles', await p.getAttribute('html', 'data-theme') === 'dark');
  await p.goto(L + '/socials'); ok('theme persists to /socials', await p.getAttribute('html', 'data-theme') === 'dark');
  await p.click('#themeToggle');
  await p.goto(L + '/'); await p.click('#menuBtn'); await p.waitForTimeout(300);
  ok('menu opens + focuses first link', await p.$eval('#menuPanel', n => n.classList.contains('open')) && await p.evaluate(() => document.activeElement.classList.contains('menu-link')));
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  ok('Escape closes menu, focus back on button', !(await p.$eval('#menuPanel', n => n.classList.contains('open'))) && await p.evaluate(() => document.activeElement.id === 'menuBtn'));
  ok('no page errors (home)', p.errs.length === 0, p.errs.join(' | '));
  await p.context().close();
}

// ---------- kit (the full kit suite is lab/kit-check.mjs) ----------
{
  const p = await page({ stubs: true });
  await p.goto(L + '/kit'); await p.waitForTimeout(800);
  const k = await kitPlaceholders(p);
  ok('kit(local): 3 placeholder video slots + placeholder brand rail', k.placeholderClips >= 3 && !k.workHidden && k.rail && k.label === 'Brand slots', JSON.stringify(k));
  await p.click('#shareBtn'); await p.waitForTimeout(300);
  ok('kit: share copies canonical URL', await p.evaluate(() => window.__copied) === 'https://mainlykavi.com/kit');
  ok('kit: toast visible', await p.$eval('.toast', n => n.classList.contains('show')));
  await p.evaluate(() => { navigator.clipboard.writeText = () => Promise.reject(new Error('denied')); document.execCommand = () => false; });
  await p.click('#shareBtn'); await p.waitForTimeout(300);
  ok('kit: copy failure shows selectable link', await p.isVisible('#shareFallback') && await p.evaluate(() => document.activeElement.id === 'shareUrl'));
  ok('kit: video strip + brand rail animating', await p.evaluate(() => ['stripTrack', 'brandTrack'].every(id => getComputedStyle(document.getElementById(id)).animationName !== 'none')));
  ok('kit: entrance finishes (every reveal fully shown)', await p.waitForFunction(() => [...document.querySelectorAll('.reveal, .hero-cta.reveal > *')].every(n => getComputedStyle(n).opacity === '1'), null, { timeout: 4000 }).then(() => true, () => false));
  ok('kit: portrait loads', await p.$eval('.portrait img', n => n.complete && n.naturalWidth > 0));
  ok('kit: glass = homepage material (liquid-glass.css)', await p.evaluate(() => !!document.querySelector('link[href="/liquid-glass.css"]') && !document.querySelector('link[href="/liquid-glass-buttons.css"]')));
  await p.evaluate(() => scrollTo(0, 1500)); await p.waitForTimeout(800);
  ok('kit: dock shows after hero', await p.$eval('#dock', n => !n.hidden && !n.classList.contains('is-away')));
  ok('no page errors (kit)', p.errs.length === 0, p.errs.join(' | '));
  await p.context().close();
}

// ---------- production host: no placeholders anywhere ----------
{
  const p = await page({ host: PROD });
  await p.goto(PROD + '/kit'); await p.waitForTimeout(1200);
  const k = await kitPlaceholders(p);
  ok('kit(production): no placeholder brands, no placeholder clips, no dev tags', !k.rail && k.clips === 0 && k.workHidden && k.devTags === 0, JSON.stringify(k));
  await p.goto(PROD + '/socials'); await p.waitForTimeout(1000);
  ok('socials(production): no pending rows', (await p.$$('.is-pending')).length === 0);
  ok('no page errors (production host)', p.errs.length === 0, p.errs.join(' | '));
  await p.context().close();
}

if (P) // deployed-host block needs PREVIEW_URL (a Vercel preview)
{
  const p = await page();
  await p.goto(P + '/kit'); await p.waitForTimeout(1200);
  const k = await kitPlaceholders(p);
  ok('kit(preview host): placeholder brands shown, labelled', k.rail && k.label === 'Brand slots', JSON.stringify(k));
  ok('kit(preview host): no placeholder clips, no dev tags', k.clips === 0 && k.workHidden && k.devTags === 0, JSON.stringify(k));
  ok('kit(preview host): portrait loads', await p.$eval('.portrait img', n => n.complete && n.naturalWidth > 0));
  await p.goto(P + '/socials'); await p.waitForTimeout(1000);
  ok('socials(live host): no pending rows, UGC = Zorrid only', (await p.$$('.is-pending')).length === 0 && (await p.$$('#ugc a')).length === 1);
  ok('socials: 6 primary tiles render with icons', (await p.$$('#primary .tile .app-icon')).length === 6);
  ok('no page errors (live host)', p.errs.length === 0, p.errs.join(' | '));
  await p.context().close();
}

// ---------- contact ----------
{
  const p = await page({ stubs: true, w: 390, h: 844 });
  await p.goto(L + '/contact'); await p.waitForTimeout(500);
  await p.click('[data-copy-email]'); await p.waitForTimeout(250);
  ok('contact: copy email', await p.evaluate(() => window.__copied) === 'collabs@mainlykavi.com');
  ok('contact: mailto has subject', /^mailto:collabs@mainlykavi\.com\?subject=/.test(await p.getAttribute('.card-main', 'href')));
  const h = await p.$eval('.card .value', n => n.getBoundingClientRect().height / parseFloat(getComputedStyle(n).lineHeight));
  ok('contact: email wraps cleanly (<=2 lines)', Math.round(h) <= 2, String(Math.round(h)));
  const ow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok('contact: no horizontal overflow at 390', ow <= 0, String(ow));
  ok('no page errors (contact)', p.errs.length === 0, p.errs.join(' | '));
  await p.context().close();
}

// ---------- reduced motion ----------
{
  const p = await page({ reduced: true });
  await p.goto(L + '/'); await p.waitForTimeout(300);
  ok('reduced motion: no petals', await p.$eval('.petals', n => n.children.length === 0 || getComputedStyle(n).display === 'none'));
  await p.goto(L + '/kit'); await p.waitForTimeout(400);
  ok('reduced motion: kit strip + rail static', await p.evaluate(() => ['stripTrack', 'brandTrack'].every(id => document.getElementById(id).getAnimations().every(a => a.playState !== 'running'))));
  await p.context().close();
}
await browser.close();
console.log(`== ${engine} ==\n` + results.join('\n') + `\n${results.length - failures}/${results.length} passed`);
process.exit(failures ? 1 : 0);
