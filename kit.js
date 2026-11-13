/* MainlyKavi media kit: renders the config-driven parts of /kit. */
(function(){
  'use strict';

  var MK = window.MK || {};
  var S = window.MKSite;
  var kit = MK.kit || {};
  var doc = document;
  var esc = S.esc;
  var preview = S.preview;
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

  /* ---------- portrait ---------- */
  var portrait = doc.getElementById('portrait');
  var heroPhoto = doc.getElementById('heroPhoto');
  var p = kit.portrait || {};
  if (portrait){
    if (p.src && !p.placeholder){
      portrait.innerHTML = '<img src="' + esc(p.src) + '" alt="' + esc(p.alt || MK.realName || '') + '" width="1200" height="1500" fetchpriority="high" decoding="async">';
    } else if (preview){
      portrait.innerHTML =
        '<div class="portrait-placeholder" role="img" aria-label="Portrait placeholder">' +
          '<span class="mono" aria-hidden="true">K</span>' + DEV +
          '<p>Your hero portrait goes here: 4:5, at least 1200px wide. Set <code>kit.portrait</code> in site-config.js.</p>' +
        '</div>';
    } else {
      /* No real portrait yet: let the (real, existing) polaroid carry the hero. */
      portrait.remove();
      heroPhoto.classList.add('no-portrait');
    }
  }

  /* ---------- selected work: three 9:16 slots ---------- */
  var PLACEHOLDER_TINTS = [
    'linear-gradient(160deg, #f7c6d4 0%, #f3ede2 55%, #dfe6c9 100%)',
    'linear-gradient(200deg, #cfe0f2 0%, #f3ede2 55%, #f7c6d4 100%)',
    'linear-gradient(160deg, #dfe6c9 0%, #f3ede2 50%, #f3d7a8 100%)'
  ];
  var PLAY = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.8v14.4a1 1 0 0 0 1.5.86l12-7.2a1 1 0 0 0 0-1.72l-12-7.2A1 1 0 0 0 7 4.8Z"/></svg>';
  var videos = (kit.videos || []).slice(0, 3).filter(function(v){
    return v.placeholder ? preview : (v.video || v.url);
  });
  var work = doc.getElementById('work');
  var reels = doc.getElementById('reels');
  if (work && reels && videos.length){
    reels.innerHTML = videos.map(function(v, i){
      var cap = '<div class="reel-cap"><strong>' + esc(v.title) + '</strong><span>' + esc(v.caption) + '</span></div>';
      var thumb = v.thumbnail ? '<img src="' + esc(v.thumbnail) + '" alt="" loading="lazy" decoding="async">' : '';
      if (v.placeholder){
        return '<li class="reel is-placeholder" style="--ph:' + PLACEHOLDER_TINTS[i % 3] + '">' +
          '<div class="reel-frame" role="img" aria-label="' + esc(v.title) + ': placeholder for a future video">' +
            '<div class="reel-ph"><span class="badge">' + DEV + '</span><span class="num">0' + (i + 1) + '</span>' +
            '<span class="lines" aria-hidden="true"><i></i><i></i><i></i></span></div>' +
          '</div>' + cap + '</li>';
      }
      if (v.video){
        return '<li class="reel"><button class="reel-frame" type="button" data-video="' + esc(v.video) + '" data-poster="' + esc(v.thumbnail || '') + '" aria-label="Play ' + esc(v.title) + '">' +
          thumb + '<span class="play lg lg-static">' + PLAY + '</span></button>' + cap + '</li>';
      }
      var host = '';
      try { host = new URL(v.url).hostname.replace(/^www\./, ''); } catch (e) {}
      return '<li class="reel"><a class="reel-frame" href="' + esc(v.url) + '" target="_blank" rel="noopener" aria-label="Watch ' + esc(v.title) + ' on ' + esc(host) + ' (opens in a new tab)">' +
        thumb + '<span class="play lg lg-static">' + PLAY + '</span></a>' + cap + '</li>';
    }).join('');
    work.hidden = false;

    /* Inline playback starts only on a click, with controls and sound. */
    reels.addEventListener('click', function(e){
      var btn = e.target.closest('button[data-video]');
      if (!btn) return;
      var video = doc.createElement('video');
      video.src = btn.getAttribute('data-video');
      if (btn.getAttribute('data-poster')) video.poster = btn.getAttribute('data-poster');
      video.controls = true;
      video.playsInline = true;
      video.preload = 'metadata';
      video.setAttribute('aria-label', btn.getAttribute('aria-label').replace(/^Play /, ''));
      var frame = doc.createElement('div');
      frame.className = 'reel-frame';
      frame.appendChild(video);
      btn.replaceWith(frame);
      video.play().catch(function(){});
      video.focus();
    });
  }

  /* ---------- brands: real & approved only; demo wordmarks in preview ---------- */
  var brands = kit.brands || {};
  var real = (brands.items || []).filter(function(b){ return b && b.name; });
  var showReal = brands.enabled === true && real.length > 0;
  var showDemo = !showReal && preview && (brands.demo || []).length > 0;
  var brandsSection = doc.getElementById('brands');
  var marquee = doc.getElementById('marquee');
  if (brandsSection && marquee && (showReal || showDemo)){
    var list = showReal ? real : brands.demo.map(function(name){ return { name: name }; });
    var item = function(b){
      var inner = b.logo ? '<img src="' + esc(b.logo) + '" alt="' + esc(b.name) + '" loading="lazy">' : '<span class="wm">' + esc(b.name) + '</span>';
      return b.url ? '<a class="marquee-item" href="' + esc(b.url) + '" target="_blank" rel="noopener">' + inner + '</a>' : '<span class="marquee-item">' + inner + '</span>';
    };
    var group = list.map(item).join('');
    /* two identical groups; the track slides by exactly one group's width */
    marquee.innerHTML = '<div class="marquee-track"><div class="marquee-group">' + group + '</div><div class="marquee-group" aria-hidden="true">' + group.replace(/<a /g, '<a tabindex="-1" ') + '</div></div>';
    marquee.style.setProperty('--marquee-dur', Math.max(24, list.length * 5.5) + 's');
    if (showDemo){
      brandsSection.querySelector('.section-title').textContent = 'Brand marquee (demo)';
      marquee.insertAdjacentHTML('afterend', '<p class="demo-note">' + DEV + ' Fictional wordmarks for testing motion. Never shown on the live site.</p>');
    }
    brandsSection.hidden = false;
    var toggle = doc.getElementById('marqueeToggle');
    toggle.addEventListener('click', function(){
      var paused = marquee.classList.toggle('paused');
      toggle.setAttribute('aria-pressed', String(paused));
      toggle.textContent = paused ? 'Play' : 'Pause';
    });
  }

  /* ---------- share ---------- */
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
  function copy(){
    S.copyText(CANONICAL).then(function(ok){
      if (ok){ S.toast('Link copied: mainlykavi.com/kit'); return; }
      fallback.hidden = false;
      var input = fallback.querySelector('input');
      input.focus();
      input.select();
      S.toast('Press Ctrl/⌘ + C to copy the link');
    });
  }
  Array.prototype.forEach.call(doc.querySelectorAll('#shareBtn, [data-share]'), function(btn){ btn.addEventListener('click', share); });

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

  /* ---------- gentle scroll-in for sections ---------- */
  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    doc.documentElement.classList.add('in-view-ready');
    var targets = doc.querySelectorAll('.make-list, .pillars li, .reel, .collab-inner > *, .share > *');
    Array.prototype.forEach.call(targets, function(n, i){ n.classList.add('fade-up'); n.style.transitionDelay = (i % 3) * 70 + 'ms'; });
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if (entry.isIntersecting){ entry.target.classList.add('is-in'); io.unobserve(entry.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    Array.prototype.forEach.call(targets, function(n){ io.observe(n); });
  }
})();
