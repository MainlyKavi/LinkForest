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

/* Per control, in CSS px: frost (a light blur: the glass is clear, Apple's clear variant over
   media), bezel (width of the curved edge the photo refracts through), bend (how far that edge
   pulls the photo in), and dim (0..1: the dimming Apple puts under labels on clear glass, used
   in full only when the photo behind is bright; siblings share one value, see shade()).
   Bigger glass is thicker: more bezel, more bend. */
const VARIANTS = {
  button: [1.6, 18, 8, 0.28],   // the three main buttons, a label on each
  label: [1.2, 14, 6.5, 0.27],  // small glass with a label (Hit me up)
  control: [0.6, 9, 4.5, 0.17]  // icon-only controls and socials
};

/* The material. Pairs are [light, dark] and cross-fade with the theme. */
const FEEL = {
  sat: [1.24, 1.16],        // vibrancy of the photo seen through the glass (1 = as is)
  lift: [0, 0.012],         // flat brightness added (keeps dark glass from going dead)
  rimLight: [0.8, 0.62],    // the crisp line where the surface turns down
  sheen: [0.26, 0.15],      // light gathered inside the curved edge
  depth: [0.06, 0.05],      // the bezel's slight shade (thickness)
  envAmt: [0.24, 0.2],      // nearby colour reflected at the grazing edge
  glowAmt: [0.34, 0.24]     // light from within on touch, under the finger first
};

const VENDOR = '/vendor/simple-liquid-glass/next.esm.js';
const REST_LIGHT = [0, -0.3];

/* Picks the shape a pixel belongs to, keeps its attributes for the shade, and gathers the
   light that pressed glass spreads onto glass nearby. */
const FIELD = `
vec4 mkA; vec4 mkB; vec4 mkBox; float mkSpill;
vec3 slg_field(vec2 p) {
  vec3 best = vec3(0.0, 0.0, 1e5);
  mkSpill = 0.0;
  for (int i = 0; i < SLG_CAPACITY; i++) {
    if (i >= slg_count) break;
    vec4 box = slg_boxes[i];
    vec4 b = slg_attributesB[i];
    vec3 f = slg_roundedBox(p - box.xy, box.zw, slg_radii[i]);
    vec2 dv = (p - box.xy - b.xy * box.zw) / 150.0;
    mkSpill += b.w * exp(-dot(dv, dv));
    if (f.z < best.z) { best = f; mkA = slg_attributesA[i]; mkB = b; mkBox = box; }
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
  if (r < 0.3) return acc;
  for (int k = 0; k < 8; k++) {
    float fk = float(k) + 0.5;
    float a = fk * 2.3999632;
    acc += mkPicture(s + vec2(cos(a), sin(a)) * r * sqrt(fk / 8.0));
  }
  return acc / 9.0;
}`;

const SHADE = `
vec4 slg_shade(vec2 p, vec3 field) {
  float d = -field.z;                 // depth inside the outline, CSS px
  vec2 n = field.xy;                  // the outline's outward normal
  float blur = mkA.x, bezel = max(mkA.y, 1.0), bend = mkA.z, dim = mkA.w;
  float glow = mkB.z, press = mkB.w;
  vec2 s = slg_screen(p);

  // The edge is a convex squircle bezel; light refracts through it (Snell, glass 1.5), so the
  // photo is pulled in hard right at the outline, less and less inward, and the centre is clear.
  float t = clamp(d / bezel, 0.0, 1.0);
  float u = 1.0 - t;
  float u4 = u * u * u * u;
  float rest = max(1.0 - u4, 1e-4);
  float z = pow(rest, 0.25);                                     // surface height, 0..1
  float slope = 2.4 * u * u * u / pow(rest, 0.75);
  float inA = atan(slope);
  float dev = tan(inA - asin(sin(inA) / 1.5));                  // 0 flat .. 1.1 at the outline
  float pull = bend * shown * (1.0 + 0.25 * press) * dev * (0.3 + 0.7 * z);
  vec2 off = -n * pull;
  vec3 col = mkFrost(s + off, blur + (blur + 1.0) * 1.2 * u * u);  // light scatters more through the thick edge

  // A trace of dispersion where the bend is strong: red bends least, blue most.
  if (pull > 0.4) {
    col.r = mix(col.r, mkPicture(s + off * 0.9).r, 0.6);
    col.b = mix(col.b, mkPicture(s + off * 1.12).b, 0.6);
  }

  // At the grazing outline the surface also reflects the colour just outside it.
  float graze = pow(1.0 - z, 2.0);
  if (graze > 0.01) col = mix(col, mkPicture(s + n * (bezel * 0.5 + 4.0)) * 1.08, graze * mkPair(envAmt) * shown);

  // Clear glass takes the photo's colour, a little more vivid. Over bright photo it dims, as
  // Apple's dimming layer does under clear glass; over dark photo it stays clear (dim is
  // worked out in JS, one value per family of siblings).
  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(luma), col, mkPair(sat));
  col *= 1.0 - dim;
  col += mkPair(lift);

  // Light from above-left (the pointer draws it round). It catches the bezel on the side facing
  // it and, through the glass, on the opposite side: the two bright corners of real glass.
  vec2 toLight = normalize(vec2(-0.68, -0.73) + mkB.xy * vec2(0.8, 0.5));
  float facing = dot(n, toLight);
  float near = pow(max(facing, 0.0), 3.0);
  float far = pow(max(-facing, 0.0), 3.0);
  float bev = u * u * u;
  col *= 1.0 - bev * mkPair(depth);
  float line = 1.0 - smoothstep(0.0, 0.7 + 1.0 / slg_scale, d);
  float spec = line * mkPair(rimLight) * (0.12 + 0.88 * near + 0.6 * far) * (1.0 + 0.4 * glow);
  spec += bev * mkPair(sheen) * (pow(max(facing, 0.0), 1.5) + 0.5 * pow(max(-facing, 0.0), 1.5));

  // Touch: the glass lights from within, under the finger first, then through the element and
  // onto glass nearby.
  vec2 at = mkBox.xy + mkB.xy * mkBox.zw;
  float reach = mix(min(mkBox.w, 24.0), max(mkBox.z, mkBox.w) * 1.5, press);
  vec2 dp = (p - at) / max(reach, 8.0);
  spec += (exp(-dot(dp, dp) * 1.5) * (glow * 0.4 + press) + min(mkSpill, 1.0) * 0.28) * mkPair(glowAmt);

  spec *= shown;
  col = 1.0 - (1.0 - clamp(col, 0.0, 1.0)) * (1.0 - clamp(spec, 0.0, 1.0));  // light adds, never greys
  return vec4(col, 1.0);
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
  host.defineMaterial({ id: 'mk', field: FIELD, shade: SHADE, uniforms: Object.assign({ night: night, fade: 1, shown: 1 }, FEEL), textures: ['uPrev'] });
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
    if (!map.has(container)) map.set(container, { container, fixed: !!fixed, items: [], families: new Map() });
    const g = map.get(container);
    const variant = !el.classList.contains('lg-sm') ? 'button' : (el.textContent.trim() ? 'label' : 'control');
    /* Siblings (a list of controls, the top bar) are one family: one dimming value for all. */
    const it = { el, variant, family: el.closest('ul') || el.parentElement, light: [REST_LIGHT[0], REST_LIGHT[1], 0, 0], dim: 0 };
    g.items.push(it);
    if (!g.families.has(it.family)) g.families.set(it.family, []);
    g.families.get(it.family).push(it);
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
    params: { night: night, fade: 1, shown: 0 },
    scale: Math.min(window.devicePixelRatio || 1, 3), // the rim is a hairline: draw it at the screen's own density
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
    shade();
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
    if (!g.drawing || g.covered || dead || g.canvas.classList.contains('is-on')) return;
    g.canvas.classList.add('is-on');
    g.items.forEach((it) => it.el.classList.add('lg-gl'));
    materialize(g);
  }));
}

/* Liquid Glass doesn't fade in: it materializes, its bending and light growing to full. */
function materialize(g) {
  cancelAnimationFrame(g.growing);
  const t0 = performance.now(), dur = reducedMotion.matches ? 0 : 650;
  const step = (now) => {
    const t = dur ? Math.min(1, (now - t0) / dur) : 1;
    if (g.layer) g.layer.setParams({ shown: ease(t) });
    g.growing = t < 1 && !dead ? requestAnimationFrame(step) : 0;
  };
  g.growing = requestAnimationFrame(step);
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
  const v = VARIANTS[it.variant];
  it.light = [hx, hy, glow, press];
  return [v[0], v[1], v[2], it.dim, hx, hy, glow, press];
}

function relayout() {
  if (dead) return;
  groups.forEach((g) => {
    if (!g.layer) return;
    measure(g);
    g.layer.resize();
    g.items.forEach((it) => it.shape && it.shape.set(shapeBox(it, 1, 1, 0, 0), { jump: true }));
  });
  shade();
}

/* ---------------- dimming ---------------- */

/* Apple dims clear glass only over bright content, and glass in one container is sampled
   together, so it reads as one material. Each family of siblings (the three buttons, the rail,
   the top bar) gets one value from the mean brightness of the photo behind all its members.
   (Each shape used to guess from 8 texture taps of its own, and neighbours came out different.) */
let prevTheme = null, fadeAmt = 1;

/* Mean luminance of the photo behind a family's members, at rest, where they are on screen now. */
function behind(items, at, name) {
  const pic = pictures[name];
  if (!pic) return 0;
  const m = pic.luma, r = pic.rect, kx = m.w / r.width, ky = m.h / r.height;
  let sum = 0, n = 0;
  items.forEach(({ base: b }) => {
    const left = at.left + b.x - b.w / 2 - r.left, top = at.top + b.y - b.h / 2 - r.top;
    const x0 = Math.max(0, Math.floor(left * kx)), x1 = Math.min(m.w, Math.ceil((left + b.w) * kx));
    const y0 = Math.max(0, Math.floor(top * ky)), y1 = Math.min(m.h, Math.ceil((top + b.h) * ky));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { sum += m.L[y * m.w + x]; n++; }
  });
  return n ? sum / n : 0;
}

function shade() {
  if (dead) return;
  groups.forEach((g) => {
    if (!g.layer || !g.hasPicture) return;
    const at = g.canvas.getBoundingClientRect();
    g.families.forEach((items) => {
      let luma = behind(items, at, theme);
      if (fadeAmt < 1 && prevTheme) { const was = behind(items, at, prevTheme); luma = was + (luma - was) * fadeAmt; }
      const t = Math.min(1, Math.max(0, (luma - 0.2) / 0.5)), k = t * t * (3 - 2 * t); // smoothstep(0.2, 0.7)
      items.forEach((it) => {
        const dim = VARIANTS[it.variant][3] * k;
        if (!it.shape || Math.abs(dim - it.dim) < 0.002) return;
        it.dim = dim;
        it.shape.setAttributes(attributes(it, ...it.light), { jump: true });
      });
    });
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
    const s = Math.max(lb.width / img.naturalWidth, lb.height / img.naturalHeight);
    const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
    const pos = cs.backgroundPosition.split(' ');
    const ox = lb.left + place(pos[0], lb.width - dw);
    const oy = lb.top + place(pos[1] || '50%', lb.height - dh);
    const blur = parseFloat((cs.filter.match(/blur\(([\d.]+)px\)/) || [])[1]) || 0;
    const rootStyle = getComputedStyle(root);
    const top = rootStyle.getPropertyValue('--scrim-top').trim(), bottom = rootStyle.getPropertyValue('--scrim-bottom').trim();
    /* Photo and scrim at k canvas px per CSS px. */
    const paint = (k, opts) => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(vb.width * k));
      canvas.height = Math.max(1, Math.round(vb.height * k));
      const ctx = canvas.getContext('2d', opts);
      if (blur && 'filter' in ctx) ctx.filter = 'blur(' + (blur * k).toFixed(2) + 'px)';
      ctx.drawImage(img, (ox - vb.left) * k, (oy - vb.top) * k, dw * k, dh * k);
      if ('filter' in ctx) ctx.filter = 'none';
      if (top && bottom) {
        /* CSS blends gradient stops premultiplied, canvas doesn't: between the day scrim's white
           and navy stops that left the picture up to 8% brighter than the page. So: darken by the
           alpha ramp, then add the premultiplied colour ramp (one colour or one alpha each, so
           canvas blends them as CSS does). */
        const c0 = rgba(ctx, top), c1 = rgba(ctx, bottom);
        const ramp = (a, b) => {
          const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
          grad.addColorStop(0, a); grad.addColorStop(0.7, b); grad.addColorStop(1, b);
          return grad;
        };
        const pm = (c) => 'rgb(' + c[0] * c[3] + ',' + c[1] * c[3] + ',' + c[2] * c[3] + ')';
        ctx.fillStyle = ramp('rgba(0,0,0,' + c0[3] + ')', 'rgba(0,0,0,' + c1[3] + ')');
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = ramp(pm(c0), pm(c1));
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'source-over';
      }
      return canvas;
    };
    /* Up to 2 texels per CSS px (the phone photo has about that much detail); at 1 the glass
       looked soft on a 3x screen. Capped at 2048 on the long side for memory. */
    const canvas = paint(Math.min(window.devicePixelRatio || 1, 2, 2048 / Math.max(vb.width, vb.height)));
    canvas.rect = { left: vb.left, top: vb.top, width: vb.width, height: vb.height };
    /* Its luminance on a coarse grid (one cell per 8 CSS px) for the dimming, painted on the CPU:
       reading the GPU picture back stalls behind the glass shader compiling. */
    const small = paint(1 / 8, { willReadFrequently: true });
    const d = small.getContext('2d').getImageData(0, 0, small.width, small.height).data;
    const L = new Float32Array(small.width * small.height);
    for (let i = 0; i < L.length; i++) L[i] = (0.2126 * d[4 * i] + 0.7152 * d[4 * i + 1] + 0.0722 * d[4 * i + 2]) / 255;
    canvas.luma = { L, w: small.width, h: small.height };
    pictures[name] = canvas;
    return canvas;
  });
}

/* Any CSS colour as [r, g, b, a]: canvas hands fillStyle back as #rrggbb or rgba(...). */
function rgba(ctx, css) {
  ctx.fillStyle = css;
  const s = ctx.fillStyle;
  if (s[0] === '#') return [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16)).concat(1);
  return s.match(/[\d.]+/g).map(Number);
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
    /* What paints in the page (glass, images, icons, text), not the boxes that hold it: the name
       row spans the column but its text sits between the controls. Testing the canvas box
       against the first row handed over 26px into the scroll, with nothing behind the glass. */
    const inks = [...main.querySelectorAll('*')].filter((el) => el.matches('.lg, img, svg:not(svg *)') || [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
    const check = () => {
      queued = false;
      const boxes = inks.map((el) => el.getBoundingClientRect());
      fixedGroups.forEach((g) => {
        const covered = g.items.some(({ el }) => {
          const c = el.getBoundingClientRect(), m = 6; // the glass grows a little on hover and press
          return boxes.some((b) => b.width && b.bottom > c.top - m && b.top < c.bottom + m && b.right > c.left - m && b.left < c.right + m);
        });
        if (covered === !!g.covered) return;
        g.covered = covered;
        if (covered) disengage(g); else engage(g);
      });
    };
    addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(check); } }, { passive: true });
    addEventListener('resize', check);
    check();
  }

  /* Scrolled glass has different photo behind it. */
  let shading = 0;
  addEventListener('scroll', () => { if (!shading) shading = requestAnimationFrame(() => { shading = 0; shade(); }); }, { passive: true });

  /* The picture depends only on the backdrop's size; the toolbar changing innerHeight is not a reason to rebuild it. */
  const backdropSize = () => { const r = document.querySelector('.backdrop').getBoundingClientRect(); return r.width + 'x' + r.height; };
  let frame = 0, timer = 0, size = backdropSize();
  const soon = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(relayout); };
  addEventListener('resize', () => {
    soon();
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (backdropSize() === size) return;
      size = backdropSize();
      for (const k in pictures) delete pictures[k];
      composePicture(theme).then(() => groups.forEach((g) => bitmapOf(theme).then((bmp) => {
        if (dead || !g.layer) return bmp.close();
        g.layer.setBackdrop(bmp, { rect: pictures[theme].rect, fixed: true });
        shade();
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
  prevTheme = prev;
  fadeAmt = 0; // the dimming follows the photo's crossfade, which starts once the new one is ready
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
    fadeAmt = e;
    groups.forEach((g) => g.layer && g.layer.setParams({ fade: e, night: night }));
    shade();
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
