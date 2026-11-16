// Mobile interaction checks for the homepage Liquid Glass (iPhone-sized, touch, DPR 3).
//   node lab/serve.mjs . 4175
//   PLAYWRIGHT=<path to playwright-core> node lab/mobile-glass.mjs chromium|webkit [port]
// Touch drags need Chromium's CDP; WebKit runs the rest. Real iOS Safari still needs a device:
// emulation has no UI-process scrolling and no collapsing toolbar (modelled below where noted).
const { chromium, webkit } = await import(process.env.PLAYWRIGHT || 'playwright-core');
const engine = process.argv[2] || 'chromium';
const BASE = 'http://localhost:' + (process.argv[3] || 4175) + '/';
const browser = await (engine === 'webkit' ? webkit : chromium).launch(engine === 'chromium' ? { channel: 'chrome' } : {});
let failures = 0;
const ok = (name, cond, detail = '') => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (detail ? '  [' + detail + ']' : '')); if (!cond) failures++; };

async function open(w, h, init) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await ctx.route(/plausible\.io|_vercel/, (r) => r.fulfill({ status: 204, body: '' }));
  if (init) await ctx.addInitScript(init);
  const p = await ctx.newPage();
  p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message));
  await p.goto(BASE);
  await p.waitForFunction(() => document.querySelectorAll('.lg-canvas.is-on').length === 2 && document.querySelectorAll('.lg-gl').length >= 11, null, { timeout: 20000 });
  await p.waitForTimeout(900); // materialize settles
  await p.evaluate(() => document.addEventListener('click', (e) => { if (e.target.closest('a')) e.preventDefault(); }, true));
  return p;
}
/* Records, every frame, whether the top-bar glass is still drawn by WebGL, and how lit any glass gets. */
const watch = () => {
  const top = document.querySelector('.topbar .lg-canvas');
  const w = window.__w = { topOff: 0, maxY: 0, pressed: 0, glow: 0 };
  const m = window.LiquidGlassMaterial, paint = m.paint;
  m.paint = function (el, tx, ty, sx, sy, hx, hy, glow) { w.glow = Math.max(w.glow, glow || 0); return paint.apply(this, arguments); };
  new MutationObserver((l) => l.forEach((r) => { if (r.target.classList.contains('is-lg-pressed')) w.pressed++; })).observe(document.querySelector('main'), { subtree: true, attributes: true, attributeFilter: ['class'] });
  const f = () => { if (!top.classList.contains('is-on')) w.topOff++; w.maxY = Math.max(w.maxY, scrollY); requestAnimationFrame(f); };
  f();
};
async function scrollThrough(p, cdp, startX, startY, dist) {
  if (cdp) { // a real finger: touch events through Chromium's input pipeline (compositor scrolling)
    const drag = async (y0, dy) => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: startX, y: y0 }] });
      for (let i = 1; i <= 18; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: startX, y: y0 + dy * i / 18 }] }); await p.waitForTimeout(16); }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    await drag(startY, -dist); await p.waitForTimeout(900); await drag(startY - dist, dist);
  } else {
    await p.evaluate((d) => new Promise((done) => { let i = 0; const f = () => { scrollTo(0, d * Math.sin(Math.PI * i / 80)); if (++i <= 80) requestAnimationFrame(f); else done(); }; f(); }), dist);
  }
  await p.waitForTimeout(1000);
}

/* 1. The top-bar glass hands over to CSS only when page content really passes under a top-bar control. */
for (const [w, h, expectHandover] of [[393, 659, false], [430, 739, false], [375, 553, true]]) {
  const p = await open(w, h);
  const cdp = engine === 'chromium' ? await p.context().newCDPSession(p) : null;
  await p.evaluate(watch);
  await scrollThrough(p, cdp, 30, h - 140, h - 200);
  const r = await p.evaluate(() => ({ topOff: window.__w.topOff, maxY: Math.round(window.__w.maxY), onAtTop: document.querySelector('.topbar .lg-canvas').classList.contains('is-on') }));
  if (expectHandover) ok(`top bar ${w}x${h}: content under the controls -> CSS glass, WebGL again at the top`, r.topOff > 0 && r.onAtTop, JSON.stringify(r));
  else ok(`top bar ${w}x${h}: stays WebGL glass through a full scroll (nothing passes under it)`, r.topOff === 0 && r.maxY > 30, JSON.stringify(r));
  ok(`no page errors (${w}x${h})`, !p.errs.length, p.errs.join(' | '));
  await p.context().close();
}

/* 2. Touch: a scroll that starts on glass never lights it; a tap and a hold still do. */
if (engine === 'chromium') {
  const p = await open(393, 659);
  const cdp = await p.context().newCDPSession(p);
  await p.evaluate(watch);
  const b = await p.locator('.home-btn[href="/kit"]').boundingBox();
  const x = b.x + b.width / 2, y = b.y + b.height / 2;
  await scrollThrough(p, cdp, x, y, 250);
  let r = await p.evaluate(() => ({ pressed: window.__w.pressed, glow: +window.__w.glow.toFixed(2), maxY: Math.round(window.__w.maxY) }));
  ok('touch: a scroll starting on a button does not press or light the glass', r.maxY > 30 && r.pressed === 0 && r.glow < 0.05, JSON.stringify(r));
  await p.evaluate(() => { scrollTo(0, 0); window.__w.pressed = 0; window.__w.glow = 0; }); await p.waitForTimeout(300);
  const t = await p.locator('.home-btn[href="/kit"]').boundingBox();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: t.x + 60, y: t.y + 30 }] });
  await p.waitForTimeout(50);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await p.waitForTimeout(500);
  r = await p.evaluate(() => ({ pressed: window.__w.pressed, glow: +window.__w.glow.toFixed(2) }));
  ok('touch: a quick tap still swells and lights the glass', r.pressed > 0 && r.glow > 0.3, JSON.stringify(r));
  await p.evaluate(() => { window.__w.pressed = 0; window.__w.glow = 0; });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: t.x + 60, y: t.y + 30 }] });
  await p.waitForTimeout(400);
  const held = await p.evaluate(() => ({ pressedNow: !!document.querySelector('.is-lg-pressed'), glow: +window.__w.glow.toFixed(2) }));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await p.waitForTimeout(600);
  const after = await p.evaluate(() => !document.querySelector('.is-lg-pressed'));
  ok('touch: press and hold lights the glass, release lets go', held.pressedNow && held.glow > 0.3 && after, JSON.stringify({ ...held, releasedAfter: after }));
  ok('no page errors (touch)', !p.errs.length, p.errs.join(' | '));
  await p.context().close();

  /* The same springs run on every page: a tap shows its press, a scroll from a control does not. */
  for (const path of ['/socials', '/contact']) {
    const ctx = await browser.newContext({ viewport: { width: 393, height: 659 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    await ctx.route(/plausible\.io|_vercel/, (r) => r.fulfill({ status: 204, body: '' }));
    const q = await ctx.newPage(); await q.goto(BASE.replace(/\/$/, '') + path); await q.waitForTimeout(1500);
    await q.evaluate(() => {
      document.addEventListener('click', (e) => { if (e.target.closest('a')) e.preventDefault(); }, true);
      const w = window.__w = { n: 0, ms: 0, on: 0 };
      new MutationObserver(() => { const now = !!document.querySelector('main .is-lg-pressed'); if (now && !w.on) { w.on = performance.now(); w.n++; } if (!now && w.on) { w.ms += performance.now() - w.on; w.on = 0; } })
        .observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
    });
    const el = q.locator('main .liquid-glass-control').first(); await el.scrollIntoViewIfNeeded();
    const bb = await el.boundingBox(), cx = bb.x + bb.width / 2, cy = bb.y + bb.height / 2, qc = await ctx.newCDPSession(q);
    await qc.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy }] }); await q.waitForTimeout(60);
    await qc.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await q.waitForTimeout(700);
    const tap = await q.evaluate(() => ({ presses: window.__w.n, visibleMs: Math.round(window.__w.ms) }));
    await q.evaluate(() => { window.__w.n = 0; });
    await qc.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy }] });
    for (let i = 1; i <= 14; i++) { await qc.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx, y: cy - i * 14 }] }); await q.waitForTimeout(16); }
    await qc.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await q.waitForTimeout(700);
    const scrolled = await q.evaluate(() => window.__w.n);
    ok(`touch ${path}: a tap shows its press (>=100ms), a scroll from a control does not`, tap.presses === 1 && tap.visibleMs >= 100 && scrolled === 0, JSON.stringify({ ...tap, pressesWhileScrolling: scrolled }));
    await ctx.close();
  }
}

/* 3. Toolbar: Safari's toolbar hiding changes the visible height but not the large viewport. Modelled
   by pinning the backdrop to the large-viewport height (745) from first paint, as lvh is on iOS, and
   resizing 659 -> 745 -> 659. (Pinning after load is a real size change and rightly rebuilds once.) */
{
  const p = await open(393, 659, () => document.addEventListener('DOMContentLoaded', () => {
    const s = document.createElement('style'); s.textContent = '.backdrop{height:745px!important}'; document.head.appendChild(s);
  }));
  /* Emulation has one viewport size (lvh = visible height), so check the declared rule. */
  const declared = await p.evaluate(() => [...document.styleSheets].flatMap((s) => { try { return [...s.cssRules]; } catch (e) { return []; } })
    .filter((r) => r.selectorText === '.backdrop' && r.parentStyleSheet.href).map((r) => r.style.height).join(' '));
  ok('backdrop is sized by the large viewport (does not track the toolbar)', /lvh/.test(declared), declared || 'no height');
  await p.evaluate(() => scrollTo(0, 60)); await p.waitForTimeout(500);
  const scale = () => { const l = document.querySelector('.backdrop-layer.day'), r = l.getBoundingClientRect(); return +(r.width / r.height).toFixed(4) + ':' + Math.round(r.height); };
  const s0 = await p.evaluate(scale);
  await p.evaluate(() => { window.__bitmaps = 0; const c = window.createImageBitmap; window.createImageBitmap = function () { window.__bitmaps++; return c.apply(this, arguments); }; });
  await p.setViewportSize({ width: 393, height: 745 }); await p.waitForTimeout(1200);
  await p.setViewportSize({ width: 393, height: 659 }); await p.waitForTimeout(1200);
  const r = await p.evaluate((s) => ({ bitmaps: window.__bitmaps, layer: s }), await p.evaluate(scale));
  ok('toolbar hide/show: photo keeps its size and the glass texture is not rebuilt', r.bitmaps === 0 && r.layer === s0, JSON.stringify({ ...r, before: s0 }));
  await p.setViewportSize({ width: 430, height: 659 }); await p.waitForTimeout(1200);
  ok('real resize (width change): glass texture is rebuilt', await p.evaluate(() => window.__bitmaps) >= 2);
  ok('no page errors (toolbar)', !p.errs.length, p.errs.join(' | '));
  await p.context().close();
}

await browser.close();
console.log(`== ${engine}: ${failures ? failures + ' failed' : 'all passed'} ==`);
process.exit(failures ? 1 : 0);
