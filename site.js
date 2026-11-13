/* MainlyKavi: shared behaviour + config-driven rendering.
   Reads window.MK (site-config.js) and window.MK_ICONS (app-icons.js). */
(function(){
  'use strict';

  var MK = window.MK || {};
  var ICONS = window.MK_ICONS || {};
  var doc = document;
  var root = doc.documentElement;
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* Placeholders and demo content render on a local dev server only. There is
     deliberately no URL switch: every deployed URL (Vercel previews included)
     shows exactly what mainlykavi.com will show. */
  var preview = /^(localhost|127\.0\.0\.1|\[::1\])$|\.localhost$/.test(location.hostname);
  root.classList.toggle('is-preview', preview);

  function esc(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g, function(c){
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
    });
  }
  function isLive(item){ return item && item.enabled !== false && !!item.url; }
  function isExternal(url){ return /^https?:/i.test(url) && url.indexOf(MK.site || 'https://mainlykavi.com') !== 0; }

  var GLYPHS = {
    youtube:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M22 8.4s-.2-1.6-.8-2.3c-.8-.8-1.7-.8-2.1-.9C16.4 5 12 5 12 5s-4.4 0-7.1.2c-.4 0-1.3.1-2.1.9C2.2 6.8 2 8.4 2 8.4S1.8 10.3 1.8 12.1v1.7c0 1.9.2 3.7.2 3.7s.2 1.6.8 2.3c.8.9 1.9.8 2.4.9 1.7.2 7.3.2 7.3.2s4.4 0 7.1-.2c.4 0 1.3-.1 2.1-.9.6-.7.8-2.3.8-2.3s.2-1.9.2-3.7v-1.7c0-1.9-.2-3.7-.2-3.7ZM9.9 15.5V9.4l5.4 3.05-5.4 3.05Z"/></svg>',
    instagram:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5.2"/><circle cx="12" cy="12" r="4.1"/><circle cx="17.3" cy="6.7" r="1.15" fill="currentColor" stroke="none"/></svg>',
    x:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L2.016 2.25h6.937l4.265 5.644 5.026-5.644Zm-1.161 17.52h1.833L7.084 4.126H5.117Z"/></svg>',
    tiktok:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.75a4.85 4.85 0 0 1-1.01-.06Z"/></svg>',
    facebook:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.04c-5.52 0-10 4.48-10 10.02 0 5 3.66 9.15 8.44 9.9v-7H7.9v-2.9h2.54V9.85c0-2.51 1.49-3.89 3.78-3.89 1.09 0 2.23.19 2.23.19v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.45 2.9h-2.33v7a10 10 0 0 0 8.44-9.9c0-5.54-4.48-10.02-10-10.02Z"/></svg>',
    mail:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="4.5" width="19" height="15" rx="3"/><path d="m3.5 7 7.4 5.3a1.9 1.9 0 0 0 2.2 0L20.5 7"/></svg>',
    arrow:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    out:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>',
    copy:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8.5" y="8.5" width="12" height="12" rx="2.6"/><path d="M15.5 8.5V6.1a2.6 2.6 0 0 0-2.6-2.6H6.1a2.6 2.6 0 0 0-2.6 2.6v6.8a2.6 2.6 0 0 0 2.6 2.6h2.4"/></svg>',
    check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.2 4.2L19 7"/></svg>'
  };

  function appIcon(id, label){
    var icon = ICONS[id];
    if (!icon){
      return '<span class="app-icon monogram" aria-hidden="true"><span>' + esc((label || '?').charAt(0)) + '</span></span>';
    }
    return '<span class="app-icon ' + esc(icon.cls) + '"' + (icon.style ? ' style="' + esc(icon.style) + '"' : '') + ' aria-hidden="true">' + icon.html + '</span>';
  }

  function mailtoHref(){
    var c = MK.contact || {};
    if (!c.email) return '/contact';
    return 'mailto:' + c.email + '?subject=' + encodeURIComponent(c.subject || '') + '&body=' + encodeURIComponent(c.body || '');
  }

  /* ---------- toast ---------- */
  var toastEl = null, toastTimer = 0;
  function toast(message){
    if (!toastEl){
      toastEl = doc.createElement('div');
      toastEl.className = 'toast lg lg-static';
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
      doc.body.appendChild(toastEl);
    }
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){ toastEl.classList.remove('show'); }, 2200);
  }

  /* ---------- clipboard, with a legacy fallback ---------- */
  function copyText(text){
    if (navigator.clipboard && window.isSecureContext){
      return navigator.clipboard.writeText(text).then(function(){ return true; }, function(){ return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }
  function legacyCopy(text){
    var area = doc.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
    doc.body.appendChild(area);
    area.select();
    var ok = false;
    try { ok = doc.execCommand('copy'); } catch (e) {}
    area.remove();
    return ok;
  }

  /* ---------- theme ---------- */
  var THEME_KEY = 'mainlykavi-theme';
  function applyTheme(theme, toggle){
    root.setAttribute('data-theme', theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
    if (toggle){
      toggle.setAttribute('aria-pressed', String(theme === 'dark'));
      var meta = doc.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', theme === 'dark' ? '#0b1430' : '#3f7fc6');
    }
  }
  var themeToggle = doc.getElementById('themeToggle');
  if (themeToggle){
    applyTheme(root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light', themeToggle);
    themeToggle.addEventListener('click', function(){
      applyTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark', themeToggle);
    });
  }

  /* ---------- menu (focus is kept inside while open) ---------- */
  var menuBtn = doc.getElementById('menuBtn');
  var menuPanel = doc.getElementById('menuPanel');
  var menuScrim = doc.getElementById('menuScrim');
  var menuClose = doc.getElementById('menuCloseBtn');
  function openMenu(){
    menuScrim.hidden = false;
    requestAnimationFrame(function(){ menuScrim.classList.add('show'); });
    menuPanel.classList.add('open');
    menuPanel.removeAttribute('aria-hidden');
    menuPanel.removeAttribute('inert');
    menuBtn.setAttribute('aria-expanded', 'true');
    var first = menuPanel.querySelector('.menu-link');
    if (first) setTimeout(function(){ first.focus(); }, 30);
  }
  function closeMenu(returnFocus){
    menuPanel.classList.remove('open');
    menuScrim.classList.remove('show');
    menuPanel.setAttribute('aria-hidden', 'true');
    menuPanel.setAttribute('inert', '');
    menuBtn.setAttribute('aria-expanded', 'false');
    setTimeout(function(){ menuScrim.hidden = true; }, 300);
    if (returnFocus) menuBtn.focus();
  }
  if (menuBtn && menuPanel && menuScrim){
    menuPanel.setAttribute('inert', '');
    menuBtn.addEventListener('click', openMenu);
    if (menuClose) menuClose.addEventListener('click', function(){ closeMenu(true); });
    menuScrim.addEventListener('click', function(){ closeMenu(false); });
    doc.addEventListener('keydown', function(e){
      if (!menuPanel.classList.contains('open')) return;
      if (e.key === 'Escape'){ closeMenu(true); return; }
      if (e.key === 'Tab'){
        var items = menuPanel.querySelectorAll('a[href], button');
        var first = items[0], last = items[items.length - 1];
        if (e.shiftKey && doc.activeElement === first){ e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && doc.activeElement === last){ e.preventDefault(); first.focus(); }
      }
    });
  }

  /* ---------- falling petals (glass-world pages) ---------- */
  var petals = doc.querySelector('.petals');
  if (petals && !reducedMotion.matches){
    var count = window.innerWidth < 600 ? 6 : 9;
    var html = '';
    for (var i = 0; i < count; i++){
      var d = 13 + Math.random() * 11;
      html += '<span class="petal" style="--x:' + (Math.random() * 100).toFixed(1) + '%;--s:' + (7 + Math.random() * 7).toFixed(1) +
        'px;--d:' + d.toFixed(1) + 's;--delay:' + (-Math.random() * d).toFixed(1) + 's;--drift:' + (Math.random() * 120 - 40).toFixed(0) + 'px"><i></i></span>';
    }
    petals.innerHTML = html;
    doc.addEventListener('visibilitychange', function(){
      petals.style.display = doc.hidden ? 'none' : '';
    });
  }

  /* ---------- config-driven bits ---------- */
  Array.prototype.forEach.call(doc.querySelectorAll('[data-mailto]'), function(a){ a.href = mailtoHref(); });
  /* Break opportunity before the @ so narrow screens wrap "collabs" / "@domain", never mid-word. */
  Array.prototype.forEach.call(doc.querySelectorAll('[data-email]'), function(n){
    var email = (MK.contact || {}).email || '';
    var at = email.indexOf('@');
    n.innerHTML = at > 0 ? esc(email.slice(0, at)) + '<wbr>' + esc(email.slice(at)) : esc(email);
  });
  Array.prototype.forEach.call(doc.querySelectorAll('[data-copy-email]'), function(btn){
    btn.addEventListener('click', function(){
      var email = (MK.contact || {}).email;
      copyText(email).then(function(ok){
        toast(ok ? 'Email copied: ' + email : 'Couldn’t copy. It’s ' + email);
        if (ok){ btn.classList.add('is-done'); setTimeout(function(){ btn.classList.remove('is-done'); }, 1800); }
      });
    });
  });
  Array.prototype.forEach.call(doc.querySelectorAll('[data-social]'), function(a){
    var item = (MK.socials || []).filter(function(s){ return s.id === a.getAttribute('data-social'); })[0];
    if (item && isLive(item)){
      a.href = item.url;
      var handle = a.querySelector('[data-handle]');
      if (handle) handle.textContent = item.handle;
    }
  });
  var yearEl = doc.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  window.MKSite = {
    preview: preview, esc: esc, isLive: isLive, isExternal: isExternal,
    glyph: function(id){ return GLYPHS[id] || ''; },
    appIcon: appIcon, mailtoHref: mailtoHref, toast: toast, copyText: copyText
  };
})();
