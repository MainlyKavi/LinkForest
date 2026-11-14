/* MainlyKavi Liquid Glass: the WebGL rendering of the material for [data-lens] controls.
 *
 * simple-liquid-glass 6.0's low-level renderer (vendor/, MIT) draws every glass shape
 * that shares a placement into one canvas, only when something changes, from a worker
 * where the browser allows. What it bends is the page's own photo, composed here into a
 * texture: no DOM capture, no per-button contexts. Two canvases on the homepage: one in
 * the fixed top bar, one in the page.
 *
 * Until it is ready, and wherever WebGL is missing or fails, or the visitor asks for less
 * transparency or more contrast, the CSS rendering in liquid-glass.css stays.
 * ?glass=fallback forces the CSS rendering, for side-by-side checks.
 *
 * The feel lives in VARIANTS and FEEL below; the shader says what each value does.
 */

/* ---------------- the feel ---------------- */

/* Per control, in CSS px: frost (blur radius), rim (width of the curved edge), bend (how far
   the edge pulls the photo in), and legibility (0..1: how far bright photo is brought down
   under the label). */
const VARIANTS = {
  button: [6, 15, 7, 0.8],    // the three main buttons: regular glass, a label on it
  label: [4, 12, 5, 0.8],     // small glass with a label (Hit me up)
  control: [2.5, 11, 5, 0.4]  // icon-only controls and socials: clear glass
};

/* The material. Pairs are [light, dark] and cross-fade with the theme. */
const FEEL = {
  sat: [1.1, 1.06],         // colour of the photo seen through the glass (1 = as is)
  tint: [0.05, 0],          // how far the glass leans to white (its own colour, kept tiny)
  lift: [0, 0.03],          // flat brightness added (dark mode keeps the glass from going black)
  ceiling: [0.44, 0.5],     // luma the photo is brought down toward under labels
  rimLight: [0.42, 0.28],   // the hairline that catches the light
  sheen: [0.09, 0.05],      // soft light inside the lit bevel
  depth: [0.07, 0.1],       // soft shade inside the far bevel
  glowAmt: [0.14, 0.09]     // light that gathers under the pointer / finger
};

const VENDOR = '/vendor/simple-liquid-glass/next.esm.js';
const REST_LIGHT = [0, -0.3];

/* Picks the shape a pixel belongs to and keeps its attributes for the shade. */
const FIELD = `
vec4 mkA; vec4 mkB; vec4 mkBox;
vec3 slg_field(vec2 p) {
  vec3 best = vec3(0.0, 0.0, 1e5);
  for (int i = 0; i < SLG_CAPACITY; i++) {
    if (i >= slg_count) break;
    vec3 f = slg_roundedBox(p - slg_boxes[i].xy, slg_boxes[i].zw, slg_radii[i]);
    if (f.z < best.z) { best = f; mkA = slg_attributesA[i]; mkB = slg_attributesB[i]; mkBox = slg_boxes[i]; }
  }
  return best;
}
float mkPair(vec2 v) { return mix(v.x, v.y, night); }
vec3 mkPicture(vec2 screen) {
  vec2 uv = clamp((screen - uBackdropRect.xy) / uBackdropRect.zw, 0.001, 0.999);
  vec3 now = texture2D(uBackdrop, uv).rgb;
  if (fade > 0.999) return now;
  return mix(texture2D(uPrev, uv).rgb, now, fade);
}
vec3 mkFrost(vec2 s, float r) {
  vec3 acc = mkPicture(s);
  if (r < 0.5) return acc;
  for (int k = 0; k < 12; k++) {
    float fk = float(k) + 0.5;
    float a = fk * 2.3999632;
    acc += mkPicture(s + vec2(cos(a), sin(a)) * r * sqrt(fk / 12.0));
  }
  return acc / 13.0;
}`;

const SHADE = `
vec4 slg_shade(vec2 p, vec3 field) {
  float d = -field.z;                 // depth inside the outline, CSS px
  vec2 n = field.xy;                  // the outline's outward normal
  float glow = mkB.z, press = mkB.w;
  float rim = max(mkA.y, 1.0);

  // A domed edge: the photo is pulled in hardest at the outline, not at all past the rim,
  // so the middle stays calm.
  float slope = cos(clamp(d / rim, 0.0, 1.0) * 1.5707963);
  slope *= slope;
  float bend = mkA.z * (1.0 + 0.12 * glow - 0.15 * press);
  vec3 col = mkFrost(slg_screen(p) - n * bend * slope, mkA.x * (1.0 + 0.35 * press));

  // Clear glass: almost no colour of its own, it takes the photo's.
  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(luma), col, mkPair(sat));
  col = mix(col, vec3(1.0), mkPair(tint)) + mkPair(lift);

  // Legibility: bright photo under a label is brought down toward a ceiling, hue kept.
  luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  float cap = mkPair(ceiling);
  if (luma > cap) col *= mix(1.0, (cap + (luma - cap) * 0.35) / luma, mkA.w);

  // Light from above, a little left; the pointer draws it round.
  vec2 toLight = normalize(vec2(-0.35, -1.0) + mkB.xy * vec2(0.9, 0.6));
  float facing = dot(n, toLight);
  float lit = pow(max(facing, 0.0), 1.6);
  float far = pow(max(-facing, 0.0), 2.0);

  // The edge: a hairline that catches the light, faint on the far side. Not a border.
  float line = 1.0 - smoothstep(0.2, 0.8 + 0.5 / slg_scale, d);
  col += vec3(line * mkPair(rimLight) * (1.0 + 0.3 * glow) * (0.07 + 0.93 * lit + 0.22 * far));

  // Inside the bevel: a soft sheen on the lit side, a soft shade on the far side.
  float bevel = 1.0 - smoothstep(0.0, rim * 0.85, d);
  col += vec3(bevel * bevel * lit * mkPair(sheen));
  col *= 1.0 - bevel * far * mkPair(depth);

  // Touch: light gathers where the pointer is.
  vec2 at = mkBox.xy + mkB.xy * mkBox.zw;
  float reach = max(min(mkBox.w * 2.2, 90.0), 20.0);
  vec2 dp = (p - at) / reach;
  col += vec3(exp(-dot(dp, dp) * 2.0) * (glow * 0.6 + press) * mkPair(glowAmt));

  return vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

/* ---------------- setup ---------------- */

const root = document.documentElement;
const byEl = new Map();
const groups = [];
const pictures = {};
let host = null;
let dead = false;
let theme = themeNow();
let night = theme === 'dark' ? 1 : 0;

/* buttons.js calls this every frame a control animates (and once when it comes to rest). */
window.LiquidGlassMaterial = {
  paint(el, tx, ty, sx, sy, hx, hy, glow, press) {
    const it = byEl.get(el);
    if (!it || !it.shape) return;
    it.shape.set(shapeBox(it, sx, sy, tx, ty), { jump: true });
    it.shape.setAttributes(attributes(it, (hx - 0.5) * 2, (hy - 0.5) * 2, glow || 0, press || 0), { jump: true });
  }
};

/* iOS: a switch's knob turns to glass while it is touched, and stays glass as it slides. */
const toggle = document.getElementById('themeToggle');
if (toggle) toggle.addEventListener('click', () => {
  toggle.classList.add('is-switching');
  setTimeout(() => toggle.classList.remove('is-switching'), 420);
});

let forced = null;
try { forced = new URLSearchParams(location.search).get('glass'); } catch (e) { /* no URL API */ }
const lessGlass = ['(prefers-reduced-transparency: reduce)', '(prefers-contrast: more)'].map((q) => matchMedia(q));
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

if (forced !== 'fallback' && 'createImageBitmap' in window && window.WebGLRenderingContext && !lessGlass.some((m) => m.matches)) {
  lessGlass.forEach((m) => m.addEventListener && m.addEventListener('change', () => { if (m.matches) teardown(); }));
  /* An enhancement over glass that is already painted: start once the page has loaded,
     is idle, and its entrance animations have finished (so the boxes measured are final). */
  const idle = () => ('requestIdleCallback' in window ? requestIdleCallback(boot, { timeout: 1500 }) : setTimeout(boot, 300));
  if (document.readyState === 'complete') idle();
  else addEventListener('load', idle, { once: true });
}

function boot() {
  const entrances = document.getAnimations ? document.getAnimations().filter((a) => {
    const t = a.effect && a.effect.target;
    return t && t.closest && t.closest('.reveal, .reveal-g') && a.effect.getTiming().iterations !== Infinity;
  }) : [];
  /* A page opened in a background tab may not run them yet: don't wait for ever. */
  const settled = Promise.all(entrances.map((a) => a.finished.catch(() => null)));
  Promise.race([settled, new Promise((done) => setTimeout(done, 2500))])
    .then(() => import(VENDOR))
    .then(start)
    .catch(() => root.classList.add('lg-gl-off'));
}

function start(lib) {
  if (dead) return;
  const found = collect();
  if (!found.length) return;
  theme = themeNow();
  night = theme === 'dark' ? 1 : 0;
  host = lib.createGlassHost();
  host.defineMaterial({ id: 'mk', field: FIELD, shade: SHADE, uniforms: Object.assign({ night: night, fade: 1 }, FEEL), textures: ['uPrev'] });
  composePicture(theme).then(() => {
    if (dead) return;
    found.forEach((g) => { groups.push(g); setupGroup(g); });
    watch();
  }).catch(() => root.classList.add('lg-gl-off'));
}

/* Lens elements, grouped by placement: those inside a fixed ancestor share its canvas,
   the rest share one canvas in the page. */
function collect() {
  const map = new Map();
  document.querySelectorAll('.lg[data-lens]').forEach((el) => {
    const fixed = fixedAncestor(el);
    const container = fixed || el.closest('main') || document.body;
    if (!map.has(container)) map.set(container, { container, fixed: !!fixed, items: [] });
    const variant = !el.classList.contains('lg-sm') ? 'button' : (el.textContent.trim() ? 'label' : 'control');
    map.get(container).items.push({ el, variant });
  });
  return [...map.values()];
}

function fixedAncestor(el) {
  for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
    if (getComputedStyle(n).position === 'fixed') return n;
  }
  return null;
}

function setupGroup(g) {
  const canvas = document.createElement('canvas');
  canvas.className = 'lg-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  g.container.insertBefore(canvas, g.container.firstChild);
  g.canvas = canvas;
  measure(g);
  g.layer = host.addLayer(canvas, {
    fixed: g.fixed,
    material: 'mk',
    params: { night: night, fade: 1 },
    onStatus: (status) => onStatus(g, status)
  });
  g.items.forEach((it) => {
    it.shape = g.layer.addShape(shapeBox(it, 1, 1, 0, 0), { spring: null, attributes: attributes(it, REST_LIGHT[0], REST_LIGHT[1], 0, 0) });
    byEl.set(it.el, it);
  });
  bitmapOf(theme).then((bmp) => {
    if (dead) return bmp.close();
    g.layer.setBackdrop(bmp, { rect: pictures[theme].rect, fixed: true });
    g.hasPicture = true;
    engage(g);
  });
}

function onStatus(g, status) {
  if (status === 'drawing') { g.drawing = true; engage(g); }
  else if (status === 'unsupported' || status === 'context-lost') { g.drawing = false; disengage(g); }
}

/* Hand over from the CSS rendering once the canvas has drawn with the photo in it. */
function engage(g) {
  if (!g.drawing || !g.hasPicture || g.covered || dead) return;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (!g.drawing || g.covered || dead) return;
    g.canvas.classList.add('is-on');
    g.items.forEach((it) => it.el.classList.add('lg-gl'));
  }));
}

function disengage(g) {
  if (g.canvas) g.canvas.classList.remove('is-on');
  g.items.forEach((it) => it.el.classList.remove('lg-gl'));
}

function teardown() {
  dead = true;
  groups.forEach((g) => { disengage(g); if (g.canvas) g.canvas.remove(); });
  byEl.clear();
  if (host) host.destroy();
  host = null;
}

/* ---------------- geometry ---------------- */

function measure(g) {
  const c = g.container.getBoundingClientRect();
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const boxes = g.items.map((it) => {
    const r = it.el.getBoundingClientRect();
    const t = (it.el.style.translate || '0px 0px').split(' ').map(parseFloat);
    const w = it.el.offsetWidth, h = it.el.offsetHeight;
    const radius = Math.min(parseFloat(getComputedStyle(it.el).borderTopLeftRadius) || 0, w / 2, h / 2);
    const cx = r.left + r.width / 2 - (t[0] || 0) - c.left;
    const cy = r.top + r.height / 2 - (t[1] || 0) - c.top;
    x0 = Math.min(x0, cx - w / 2); y0 = Math.min(y0, cy - h / 2);
    x1 = Math.max(x1, cx + w / 2); y1 = Math.max(y1, cy + h / 2);
    return { cx, cy, w, h, r: radius };
  });
  const pad = 6; // room for hover growth and the magnet
  const left = Math.floor(x0 - pad), top = Math.floor(y0 - pad);
  const s = g.canvas.style;
  s.left = left + 'px'; s.top = top + 'px';
  s.width = Math.ceil(x1 + pad - left) + 'px'; s.height = Math.ceil(y1 + pad - top) + 'px';
  g.items.forEach((it, i) => {
    const b = boxes[i];
    it.base = { x: b.cx - left, y: b.cy - top, w: b.w, h: b.h, r: b.r };
  });
}

function shapeBox(it, sx, sy, tx, ty) {
  const b = it.base, w = b.w * sx, h = b.h * sy;
  return { x: b.x + tx - w / 2, y: b.y + ty - h / 2, width: w, height: h, radius: Math.min(b.r * Math.min(sx, sy), w / 2, h / 2) };
}

function attributes(it, hx, hy, glow, press) {
  return VARIANTS[it.variant].concat([hx, hy, glow, press]);
}

function relayout() {
  if (dead) return;
  groups.forEach((g) => {
    if (!g.layer) return;
    measure(g);
    g.layer.resize();
    g.items.forEach((it) => it.shape && it.shape.set(shapeBox(it, 1, 1, 0, 0), { jump: true }));
  });
}

/* ---------------- the photo behind the glass ---------------- */

/* Redraws the visible backdrop (photo, cover-fitted and positioned as CSS does, plus the
   scrim) into a canvas the size of the viewport. Read while that theme is showing, so the
   theme's own scrim colours are the ones in effect. */
function composePicture(name) {
  if (pictures[name]) return Promise.resolve(pictures[name]);
  const back = document.querySelector('.backdrop');
  const layer = back && back.querySelector(name === 'dark' ? '.backdrop-layer.night' : '.backdrop-layer.day');
  if (!layer) return Promise.reject(new Error('no backdrop'));
  const cs = getComputedStyle(layer);
  const url = (cs.backgroundImage.match(/url\(["']?([^"')]+)["']?\)/) || [])[1];
  if (!url) return Promise.reject(new Error('no backdrop image'));
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  return img.decode().then(() => {
    const vb = back.getBoundingClientRect(), lb = layer.getBoundingClientRect();
    const k = Math.min(1, 1280 / Math.max(vb.width, vb.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(vb.width * k));
    canvas.height = Math.max(1, Math.round(vb.height * k));
    const ctx = canvas.getContext('2d');
    const s = Math.max(lb.width / img.naturalWidth, lb.height / img.naturalHeight);
    const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
    const pos = cs.backgroundPosition.split(' ');
    const ox = lb.left + place(pos[0], lb.width - dw);
    const oy = lb.top + place(pos[1] || '50%', lb.height - dh);
    const blur = parseFloat((cs.filter.match(/blur\(([\d.]+)px\)/) || [])[1]) || 0;
    if (blur && 'filter' in ctx) ctx.filter = 'blur(' + (blur * k).toFixed(2) + 'px)';
    ctx.drawImage(img, (ox - vb.left) * k, (oy - vb.top) * k, dw * k, dh * k);
    if ('filter' in ctx) ctx.filter = 'none';
    const rootStyle = getComputedStyle(root);
    const top = rootStyle.getPropertyValue('--scrim-top').trim(), bottom = rootStyle.getPropertyValue('--scrim-bottom').trim();
    if (top && bottom) {
      const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      grad.addColorStop(0, top); grad.addColorStop(0.7, bottom); grad.addColorStop(1, bottom);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    canvas.rect = { left: vb.left, top: vb.top, width: vb.width, height: vb.height };
    pictures[name] = canvas;
    return canvas;
  });
}

function place(v, free) {
  if (/%$/.test(v)) return free * parseFloat(v) / 100;
  if (/px$/.test(v)) return parseFloat(v);
  return free * ({ left: 0, top: 0, right: 1, bottom: 1 }[v] ?? 0.5);
}

/* A layer takes the bitmap it is given (a worker owns it), so each layer gets its own. */
function bitmapOf(name) {
  return createImageBitmap(pictures[name]);
}

/* ---------------- theme, size, layout ---------------- */

function themeNow() {
  return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function watch() {
  new MutationObserver(onTheme).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

  /* The canvas only knows the photo. Fixed glass (the top bar) has page content scrolling
     under it on short screens, and Liquid Glass lets that content show through, so while
     anything is under it the CSS rendering (a real backdrop) takes over. */
  const fixedGroups = groups.filter((g) => g.fixed);
  const main = document.querySelector('main');
  if (fixedGroups.length && main) {
    let queued = false;
    const check = () => {
      queued = false;
      const first = [...main.children].find((c) => !c.classList.contains('lg-canvas'));
      const top = first ? first.getBoundingClientRect().top : Infinity;
      fixedGroups.forEach((g) => {
        const covered = top < g.canvas.getBoundingClientRect().bottom;
        if (covered === !!g.covered) return;
        g.covered = covered;
        if (covered) disengage(g); else engage(g);
      });
    };
    addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(check); } }, { passive: true });
    addEventListener('resize', check);
    check();
  }

  let frame = 0, timer = 0, vw = innerWidth, vh = innerHeight;
  const soon = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(relayout); };
  addEventListener('resize', () => {
    soon();
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (innerWidth === vw && innerHeight === vh) return;
      vw = innerWidth; vh = innerHeight;
      for (const k in pictures) delete pictures[k];
      composePicture(theme).then(() => groups.forEach((g) => bitmapOf(theme).then((bmp) => {
        if (dead || !g.layer) return bmp.close();
        g.layer.setBackdrop(bmp, { rect: pictures[theme].rect, fixed: true });
      })));
    }, 220);
  });
  /* A control moves when anything before it changes size (a tagline that wraps, a late
     font), so watch the containers' children as well as the controls. */
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(soon);
    groups.forEach((g) => {
      ro.observe(g.container);
      [...g.container.children].forEach((child) => { if (child !== g.canvas) ro.observe(child); });
    });
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(soon);
}

function onTheme() {
  const next = themeNow();
  if (next === theme || dead) return;
  const prev = theme;
  theme = next;
  composePicture(next).then(() => Promise.all(groups.map((g) => Promise.all([bitmapOf(prev), bitmapOf(next)]).then(([old, now]) => {
    if (dead || !g.layer) { old.close(); now.close(); return; }
    /* In this order every frame in between still shows the old photo. */
    g.layer.setTexture('uPrev', old);
    g.layer.setParams({ fade: 0 });
    g.layer.setBackdrop(now, { rect: pictures[next].rect, fixed: true });
  })))).then(() => crossfade(night, next === 'dark' ? 1 : 0));
}

/* The glass changes with the photo behind it: same 1.1 s and curve as the backdrop. */
let fading = 0;
function crossfade(from, to) {
  cancelAnimationFrame(fading);
  const t0 = performance.now(), dur = reducedMotion.matches ? 0 : 1100;
  const step = (now) => {
    const t = dur ? Math.min(1, (now - t0) / dur) : 1;
    const e = ease(t);
    night = from + (to - from) * e;
    groups.forEach((g) => g.layer && g.layer.setParams({ fade: e, night: night }));
    fading = t < 1 ? requestAnimationFrame(step) : 0;
  };
  fading = requestAnimationFrame(step);
}

/* cubic-bezier(.22,.9,.26,1): the site's --ease. */
function ease(t) {
  const x1 = 0.22, y1 = 0.9, x2 = 0.26, y2 = 1;
  let u = t;
  for (let i = 0; i < 8; i++) {
    const x = 3 * (1 - u) * (1 - u) * u * x1 + 3 * (1 - u) * u * u * x2 + u * u * u - t;
    const dx = 3 * (1 - u) * (1 - u) * x1 + 6 * (1 - u) * u * (x2 - x1) + 3 * u * u * (1 - x2);
    if (Math.abs(dx) < 1e-6) break;
    u = Math.min(1, Math.max(0, u - x / dx));
  }
  return 3 * (1 - u) * (1 - u) * u * y1 + 3 * (1 - u) * u * u * y2 + u * u * u;
}
