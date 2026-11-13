/* Liquid Glass optics: real edge refraction for elements marked [data-lens].
 *
 * Each lens gets its own SVG displacement filter, generated for its exact size
 * and corner radius: a rounded bezel that pulls the backdrop inward, hardest at
 * the rim and fading to nothing a short way in, with a slight per-channel split
 * (dispersion). Chromium is the only engine that renders backdrop-filter:url(),
 * so everywhere else (Safari/iOS, Firefox) the lens is skipped and the CSS
 * frosted-glass material carries the look on its own.
 *
 * Opt in:   <a class="lg" data-lens>…</a>
 * Tuning:   data-lens-bend="1.2"    (multiplier, default 1.2)
 *           data-lens-dispersion="0.35" (0 disables the channel split)
 * Override: ?glass=fallback | ?glass=lens  (for side-by-side checks)
 */
(function(){
  'use strict';

  var root = document.documentElement;
  var forced = null;
  try { forced = new URLSearchParams(location.search).get('glass'); } catch (e) {}
  var brands = navigator.userAgentData && navigator.userAgentData.brands;
  var isChromium = !!(brands && brands.some(function(b){ return /Chromium/.test(b.brand); }));
  var enabled = forced ? forced === 'lens' : isChromium;
  root.classList.toggle('lg-optics', enabled);
  root.classList.toggle('lg-no-optics', !enabled);
  if (!enabled) return;

  var NS = 'http://www.w3.org/2000/svg';
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var defs = null;
  var maps = new Map();     // size key -> data URL (shared between same-size lenses)
  var lenses = new Map();   // element -> { filter, displacements, w, h, r, bend, current, target, raf }
  var uid = 0;

  function ensureDefs(){
    if (defs) return defs;
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
    defs = document.createElementNS(NS, 'defs');
    svg.appendChild(defs);
    document.body.appendChild(svg);
    return defs;
  }

  /* Displacement map for a rounded rect, w×h CSS px with corner radius r.
     Red/green carry x/y displacement around 128; the filter's scale turns them
     back into pixels. Bezel = 30% of the short side, 34px at most. */
  function buildMap(w, h, r){
    var key = w + 'x' + h + 'r' + r;
    if (maps.has(key)) return maps.get(key);
    var canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    /* CPU-backed canvas: a GPU canvas makes toDataURL do a slow readback. */
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    var img = ctx.createImageData(w, h);
    var data = img.data;
    var hw = w / 2, hh = h / 2;
    var rr = Math.min(r, hw, hh);
    var bezel = Math.max(4, Math.min(34, Math.min(w, h) * 0.3));
    for (var y = 0; y < h; y++){
      for (var x = 0; x < w; x++){
        var px = x + 0.5 - hw, py = y + 0.5 - hh;
        var qx = Math.abs(px) - hw + rr, qy = Math.abs(py) - hh + rr;
        var ox = Math.max(qx, 0), oy = Math.max(qy, 0);
        var dist = -(Math.min(Math.max(qx, qy), 0) + Math.sqrt(ox * ox + oy * oy) - rr); // >0 inside
        var i = (y * w + x) * 4;
        var dx = 0, dy = 0;
        if (dist > 0 && dist < bezel){
          var nx = 0, ny = 0;
          if (qx > 0 && qy > 0){
            var len = Math.sqrt(qx * qx + qy * qy) || 1;
            nx = (px < 0 ? -1 : 1) * qx / len;
            ny = (py < 0 ? -1 : 1) * qy / len;
          } else if (qx > qy) nx = px < 0 ? -1 : 1;
          else ny = py < 0 ? -1 : 1;
          var t = 1 - dist / bezel;          // 1 at the rim, 0 at the bezel's inner edge
          var m = t * t * (1.6 - 0.6 * t);    // steep at the rim, flat where it meets the face
          dx = -nx * m; dy = -ny * m;         // sample inward
        }
        data[i]     = Math.round(128 + dx * 127);
        data[i + 1] = Math.round(128 + dy * 127);
        data[i + 2] = 128;
        data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    var entry = { url: canvas.toDataURL('image/png'), bezel: bezel };
    maps.set(key, entry);
    return entry;
  }

  function el(name, attrs, parent){
    var node = document.createElementNS(NS, name);
    for (var k in attrs) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
  }

  function buildFilter(id, w, h, map, dispersion){
    var f = el('filter', {
      id: id, x: 0, y: 0, width: w, height: h,
      filterUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB'
    });
    el('feImage', { href: map.url, x: 0, y: 0, width: w, height: h, preserveAspectRatio: 'none', result: 'map' }, f);
    var displacements = [];
    if (dispersion > 0){
      var channels = [
        ['1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0', 1 + dispersion * 0.12],
        ['0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0', 1],
        ['0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0', 1 - dispersion * 0.12]
      ];
      channels.forEach(function(c, n){
        var d = el('feDisplacementMap', { in: 'SourceGraphic', in2: 'map', xChannelSelector: 'R', yChannelSelector: 'G', result: 'd' + n }, f);
        d._spread = c[1];
        displacements.push(d);
        el('feColorMatrix', { in: 'd' + n, type: 'matrix', values: c[0], result: 'c' + n }, f);
      });
      el('feBlend', { in: 'c0', in2: 'c1', mode: 'screen', result: 'c01' }, f);
      el('feBlend', { in: 'c01', in2: 'c2', mode: 'screen' }, f);
    } else {
      var d = el('feDisplacementMap', { in: 'SourceGraphic', in2: 'map', xChannelSelector: 'R', yChannelSelector: 'G' }, f);
      d._spread = 1;
      displacements.push(d);
    }
    return { filter: f, displacements: displacements };
  }

  function applyBend(lens, bend){
    lens.current = bend;
    var px = lens.bezel * 2 * bend; // full-scale map value (±127) moves this many px
    lens.displacements.forEach(function(d){ d.setAttribute('scale', (px * d._spread).toFixed(2)); });
  }

  function measure(node){
    var w = Math.round(node.offsetWidth), h = Math.round(node.offsetHeight);
    var cs = getComputedStyle(node);
    var r = parseFloat(cs.borderTopLeftRadius) || 0;
    if (/%/.test(cs.borderTopLeftRadius)) r = Math.min(w, h) * parseFloat(cs.borderTopLeftRadius) / 100;
    return { w: w, h: h, r: Math.round(Math.min(r, w / 2, h / 2)) };
  }

  function setup(node){
    var size = measure(node);
    if (size.w < 8 || size.h < 8) return;
    var lens = lenses.get(node);
    if (lens && lens.w === size.w && lens.h === size.h && lens.r === size.r) return;
    var map = buildMap(size.w, size.h, size.r);
    var id = lens ? lens.id : 'lg-lens-' + (++uid);
    var dispersion = parseFloat(node.getAttribute('data-lens-dispersion'));
    if (!isFinite(dispersion)) dispersion = 0.35;
    var built = buildFilter(id, size.w, size.h, map, dispersion);
    if (lens) lens.filter.replaceWith(built.filter); else ensureDefs().appendChild(built.filter);
    var bend = parseFloat(node.getAttribute('data-lens-bend'));
    lens = {
      id: id, w: size.w, h: size.h, r: size.r, bezel: map.bezel,
      base: isFinite(bend) ? bend : 1.2,
      filter: built.filter, displacements: built.displacements,
      current: 0, target: 0, raf: 0
    };
    lens.target = lens.base;
    lenses.set(node, lens);
    applyBend(lens, lens.base);
    node.style.setProperty('--lg-lens', 'url(#' + id + ')');
    node.classList.add('lg-lens-ready');
  }

  /* Pressing pushes the lens a little deeper; a short tween keeps it liquid. */
  function tweenTo(node, k){
    var lens = lenses.get(node);
    if (!lens) return;
    lens.target = lens.base * k;
    if (reduced.matches){ applyBend(lens, lens.target); return; }
    if (lens.raf) return;
    var step = function(){
      var next = lens.current + (lens.target - lens.current) * 0.22;
      if (Math.abs(lens.target - next) < 0.005) next = lens.target;
      applyBend(lens, next);
      lens.raf = next === lens.target ? 0 : requestAnimationFrame(step);
    };
    lens.raf = requestAnimationFrame(step);
  }

  function lensFrom(target){
    var node = target && target.closest ? target.closest('[data-lens]') : null;
    return node && lenses.has(node) ? node : null;
  }

  var observer = 'ResizeObserver' in window ? new ResizeObserver(function(entries){
    entries.forEach(function(entry){ setup(entry.target); });
  }) : null;

  function init(){
    Array.prototype.forEach.call(document.querySelectorAll('[data-lens]'), function(node){
      setup(node);
      if (observer) observer.observe(node);
    });
  }

  document.addEventListener('pointerdown', function(e){ var n = lensFrom(e.target); if (n) tweenTo(n, 1.35); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function(type){
    document.addEventListener(type, function(e){ var n = lensFrom(e.target); if (n) tweenTo(n, 1); }, true);
  });

  window.LiquidGlassOptics = { refresh: init };
  /* The lens is an enhancement on top of frosted glass that is already
     painted, so build it after load, when the main thread is idle. */
  function initWhenIdle(){
    var go = function(){ init(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(init); };
    if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 1200 });
    else setTimeout(go, 200);
  }
  if (document.readyState === 'complete') initWhenIdle();
  else window.addEventListener('load', initWhenIdle, { once: true });
})();
