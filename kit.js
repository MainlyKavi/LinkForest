/* MainlyKavi media kit: renders the config-driven parts of /kit. */
(function(){
  'use strict';

  var MK = window.MK || {};
  var S = window.MKSite;
  var kit = MK.kit || {};
  var doc = document;
  var root = doc.documentElement;
  var each = function(sel, fn){ Array.prototype.forEach.call(doc.querySelectorAll(sel), fn); };
  var esc = S.esc;
  var preview = S.preview;
  /* Placeholder brand names also show on Vercel preview URLs, never on mainlykavi.com.
     shortcut: production's own *.vercel.app aliases count as previews too; nothing links
     there (the canonical is mainlykavi.com). Match the preview URL pattern if that changes. */
  var devPreview = preview || /\.vercel\.app$/.test(location.hostname);
  var CANONICAL = (MK.site || 'https://mainlykavi.com') + '/kit';
  var DEV = '<span class="dev-tag">Dev placeholder</span>';

  var kitYear = doc.getElementById('kitYear');
  if (kitYear) kitYear.textContent = new Date().getFullYear();

  /* ---------- hero socials: glyph + label + handle from config ---------- */
  var heroSocials = doc.getElementById('heroSocials');
  if (heroSocials){
    var picks = (MK.socials || []).filter(function(s){ return s.rail && S.isLive(s) && S.glyph(s.id); }).slice(0, 4);
    if (picks.length){
      heroSocials.innerHTML = picks.map(function(s){
        return '<li><a href="' + esc(s.url) + '" target="_blank" rel="noopener" aria-label="' + esc(s.label) + ' ' + esc(s.handle) + ' (opens in a new tab)">' +
          S.glyph(s.id) + '<span>' + esc(s.label) + '</span></a></li>';
      }).join('');
    }
  }

  /* ---------- seamless loops (brand rail + work strip) ----------
     The first group holds the real items (focusable, announced) plus silent
     copies until it is long enough to overflow its window; an identical
     silent group follows. The track slides by exactly one group (-50%), so
     the seam never shows. */
  function fillLoop(track, itemsHtml, count, minItems, secondsPerItem){
    var silent = itemsHtml.replace(/<li\b/g, '<li aria-hidden="true"').replace(/<(a|button)\b/g, '<$1 tabindex="-1"');
    var reps = Math.max(1, Math.ceil(minItems / count));
    track.innerHTML =
      '<ul class="loop-group">' + itemsHtml + new Array(reps).join(silent) + '</ul>' +
      '<ul class="loop-group" aria-hidden="true">' + new Array(reps + 1).join(silent) + '</ul>';
    track.style.setProperty('--loop-dur', (reps * count * secondsPerItem) + 's');
  }

  /* ---------- brand rail ---------- */
  var brands = kit.brands || {};
  var brandList = (brands.items || []).filter(function(b){ return b && b.name; });
  var rail = doc.getElementById('brands');
  if (rail && brands.enabled !== false && brandList.length && (devPreview || !brands.placeholder)){
    fillLoop(doc.getElementById('brandTrack'), brandList.map(function(b){
      var inner = b.logo ? '<img src="' + esc(b.logo) + '" alt="' + esc(b.name) + '" loading="lazy">' : '<span class="wm">' + esc(b.name) + '</span>';
      return '<li class="brand">' + (b.url ? '<a href="' + esc(b.url) + '" target="_blank" rel="noopener">' + inner + '</a>' : inner) + '</li>';
    }).join(''), brandList.length, 14, 2.4);
    rail.querySelector('.rail-label').textContent = brands.placeholder ? 'Brand slots' : 'Brands I’ve worked with';
    doc.getElementById('brandsNote').hidden = !brands.placeholder;
    rail.hidden = false;
  }

  /* ---------- selected work: three 9:16 clips on an endless strip ---------- */
  var PLAY = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.8v14.4a1 1 0 0 0 1.5.86l12-7.2a1 1 0 0 0 0-1.72l-12-7.2A1 1 0 0 0 7 4.8Z"/></svg>';
  var videos = (kit.videos || []).slice(0, 3).filter(function(v){
    return v.placeholder ? preview : (v.video || v.url);
  });
  function clip(v, i){
    var cap = '<span class="clip-cap"><strong>' + esc(v.title) + '</strong><span>' + esc(v.caption) + '</span></span>';
    var thumb = v.thumbnail ? '<img src="' + esc(v.thumbnail) + '" alt="" width="540" height="960" loading="lazy" decoding="async">' : '';
    var play = '<span class="clip-play" aria-hidden="true">' + PLAY + '</span>';
    if (v.placeholder){
      return '<li class="clip is-placeholder" style="--ph:var(--ph-' + (i % 3) + ')"><div class="clip-frame" role="img" aria-label="' + esc(v.title) + ': placeholder for a future video">' +
        DEV + '<span class="clip-num" aria-hidden="true">0' + (i + 1) + '</span>' + cap + '</div></li>';
    }
    if (v.video){
      return '<li class="clip"><button class="clip-frame" type="button" data-video="' + esc(v.video) + '" data-poster="' + esc(v.thumbnail || '') + '" data-title="' + esc(v.title) + '" aria-label="Play ' + esc(v.title) + '">' +
        thumb + play + cap + '</button></li>';
    }
    var host = '';
    try { host = new URL(v.url).hostname.replace(/^www\./, ''); } catch (e) {}
    return '<li class="clip"><a class="clip-frame" href="' + esc(v.url) + '" target="_blank" rel="noopener" aria-label="Watch ' + esc(v.title) + ' on ' + esc(host) + ' (opens in a new tab)">' +
      thumb + play + cap + '</a></li>';
  }
  var work = doc.getElementById('work');
  var stripTrack = doc.getElementById('stripTrack');
  var player = doc.getElementById('player');
  if (work && stripTrack && videos.length){
    fillLoop(stripTrack, videos.map(clip).join(''), videos.length, 9, 5);
    work.hidden = false;
    /* reduced motion turns the strip into a swipeable row: reachable by keyboard too */
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      var strip = stripTrack.parentNode;
      strip.tabIndex = 0;
      strip.setAttribute('role', 'region');
      strip.setAttribute('aria-label', 'Selected work (scrolls sideways)');
    }
    stripTrack.addEventListener('click', function(e){
      var btn = e.target.closest('button[data-video]');
      if (!btn || !player || !player.showModal) return;
      var video = player.querySelector('video');
      video.src = btn.getAttribute('data-video');
      video.poster = btn.getAttribute('data-poster') || '';
      video.setAttribute('aria-label', btn.getAttribute('data-title'));
      player.showModal();
      video.play().catch(function(){});
    });
  } else {
    /* Nothing real to show yet: the hero link would point at nothing. */
    each('[data-work-link]', function(a){ a.remove(); });
  }
  if (player){
    player.addEventListener('click', function(e){
      if (e.target === player || e.target.closest('[data-close-player]')) player.close();
    });
    player.addEventListener('close', function(){
      var video = player.querySelector('video');
      video.pause();
      video.removeAttribute('src');
      video.load();
    });
  }

  /* ---------- motion: one toggle for every loop; loops rest off screen ---------- */
  each('[data-motion-toggle]', function(btn){
    btn.addEventListener('click', function(){
      var paused = root.classList.toggle('motion-paused');
      each('[data-motion-toggle] span', function(label){ label.textContent = paused ? 'Play motion' : 'Pause motion'; });
    });
  });
  if ('IntersectionObserver' in window){
    var loopIO = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){ entry.target.classList.toggle('is-offscreen', !entry.isIntersecting); });
    });
    each('.loop', function(n){ loopIO.observe(n); });
  }

  /* ---------- share + copy link ---------- */
  var fallback = doc.getElementById('shareFallback');
  function share(){
    var data = { title: 'Kavi Goutam: media kit', text: 'MainlyKavi, personality-driven variety creator.', url: CANONICAL };
    if (navigator.share && (!navigator.canShare || navigator.canShare(data))){
      navigator.share(data).catch(function(err){
        if (err && err.name !== 'AbortError') copy();
      });
      return;
    }
    copy();
  }
  function copy(btn){
    S.copyText(CANONICAL).then(function(ok){
      if (ok){
        S.toast('Link copied: mainlykavi.com/kit');
        var label = btn && btn.querySelector('span');
        if (label){
          label.textContent = 'Copied';
          setTimeout(function(){ label.textContent = 'Copy link'; }, 1800);
        }
        return;
      }
      /* from the hero: don't jump the page to the fallback field at the bottom */
      if (btn){ S.toast('Couldn’t copy. The link is mainlykavi.com/kit'); return; }
      fallback.hidden = false;
      var input = fallback.querySelector('input');
      input.focus();
      input.select();
      S.toast('Press Ctrl/⌘ + C to copy the link');
    });
  }
  each('#shareBtn, [data-share]', function(btn){ btn.addEventListener('click', share); });
  each('[data-copy-link]', function(btn){ btn.addEventListener('click', function(){ copy(btn); }); });

  /* ---------- floating dock: after the hero, gone again at the share block ---------- */
  var dock = doc.getElementById('dock');
  var hero = doc.querySelector('.hero');
  var shareBlock = doc.querySelector('.share');
  if (dock && hero && 'IntersectionObserver' in window){
    var heroVisible = true, shareVisible = false;
    var update = function(){
      var away = heroVisible || shareVisible;
      if (dock.hidden && !away) dock.hidden = false;
      dock.classList.toggle('is-away', away);
      dock.toggleAttribute('inert', away);
    };
    dock.classList.add('is-away');
    new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if (entry.target === hero) heroVisible = entry.isIntersecting;
        if (entry.target === shareBlock) shareVisible = entry.isIntersecting;
      });
      update();
    }, { threshold: 0, rootMargin: '0px 0px -10% 0px' }).observe(hero);
    if (shareBlock){
      new IntersectionObserver(function(entries){
        shareVisible = entries[0].isIntersecting;
        update();
      }).observe(shareBlock);
    }
  }

  /* ---------- gentle scroll-in. Only text or a glass element itself fades:
     glass inside a fading parent loses its backdrop. ---------- */
  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    root.classList.add('in-view-ready');
    var targets = doc.querySelectorAll('.section-title, .section-note, .offer, .pillars li, .collab-inner > *, .share > *');
    Array.prototype.forEach.call(targets, function(n, i){ n.classList.add('fade-up'); n.style.transitionDelay = (i % 3) * 70 + 'ms'; });
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if (entry.isIntersecting){ entry.target.classList.add('is-in'); io.unobserve(entry.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    Array.prototype.forEach.call(targets, function(n){ io.observe(n); });
  }
})();
