(function(){
  'use strict';

  /* Replace the site's old projects navigation action with the FAQ while
     preserving the projects page itself and every unrelated link. */
  Array.prototype.forEach.call(document.querySelectorAll('.menu-link[href="/projects"]'), function(link){
    if (link.textContent.trim() !== 'View all my projects') return;
    link.setAttribute('href', '/faq');
    link.textContent = 'FAQ nobody asked for';
  });

  /* The large projects card only exists on the homepage. Keep its existing
     Liquid Glass card structure and swap only its destination, label, and glyph. */
  var homePath = window.location.pathname === '/' ||
    window.location.pathname === '/index' ||
    window.location.pathname === '/index.html';
  if (homePath){
    Array.prototype.forEach.call(document.querySelectorAll('a.link-card[href="/projects"]'), function(link){
      var title = link.querySelector('.title');
      if (!title || title.textContent.trim() !== 'View all my projects') return;

      link.setAttribute('href', '/faq');
      title.textContent = 'FAQ nobody asked for';
      var glyph = link.querySelector('.glyph');
      if (glyph){
        glyph.innerHTML =
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
          'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          '<circle cx="12" cy="12" r="9"></circle>' +
          '<path d="M9.8 9a2.35 2.35 0 0 1 4.55.8c0 1.8-2.35 2.1-2.35 3.7"></path>' +
          '<path d="M12 17h.01"></path></svg>';
      }
    });
  }

  var selector = '.pill-btn, .theme-toggle, .icon-btn, .link-card, .brand-pill, .social-tile, .project-card';
  var controls = Array.prototype.slice.call(document.querySelectorAll(selector));
  if (!controls.length) return;

  var reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  var finePointerQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
  var states = new WeakMap();
  var animating = new Set();
  var pressedPointers = new Map();
  var frame = 0;
  var lastFrame = 0;

  controls.forEach(function(control){
    var profile = control.matches('.social-tile, .pill-btn, .theme-toggle, .icon-btn') ?
      { magnet:1.15, hoverScale:1.006, focusScale:1.004, pressScale:.982, wobble:.35 } :
      (control.matches('.project-card') ?
        { magnet:1.8, hoverScale:1.009, focusScale:1.005, pressScale:.978, wobble:.65 } :
        { magnet:2.8, hoverScale:1.012, focusScale:1.006, pressScale:.972, wobble:1 });
    control.classList.add('liquid-glass-control');
    states.set(control, {
      x:0, y:0, scale:1, highlightX:.5, highlightY:.35,
      wobbleX:0, wobbleY:0,
      vx:0, vy:0, vScale:0, vHighlightX:0, vHighlightY:0,
      vWobbleX:0, vWobbleY:0,
      targetX:0, targetY:0, targetScale:1,
      targetHighlightX:.5, targetHighlightY:.35,
      targetWobbleX:0, targetWobbleY:0,
      magnet:profile.magnet, hoverScale:profile.hoverScale,
      focusScale:profile.focusScale, pressScale:profile.pressScale,
      wobble:profile.wobble,
      hovered:false, focused:false, pressed:false,
      lastPointerX:0, lastPointerY:0, lastPointerTime:0
    });
  });

  function controlFrom(node){
    if (!node || node.nodeType !== 1) return null;
    var control = node.closest(selector);
    return control && states.has(control) ? control : null;
  }

  function spring(state, valueKey, velocityKey, targetKey, stiffness, damping, dt){
    var displacement = state[targetKey] - state[valueKey];
    state[velocityKey] += (stiffness * displacement - damping * state[velocityKey]) * dt;
    state[valueKey] += state[velocityKey] * dt;
  }

  function activate(control){
    animating.add(control);
    control.classList.add('is-lg-animating');
    if (!frame){
      lastFrame = performance.now();
      frame = requestAnimationFrame(tick);
    }
  }

  function isSettled(state){
    return Math.abs(state.x - state.targetX) < .01 && Math.abs(state.vx) < .02 &&
      Math.abs(state.y - state.targetY) < .01 && Math.abs(state.vy) < .02 &&
      Math.abs(state.scale - state.targetScale) < .00015 && Math.abs(state.vScale) < .0015 &&
      Math.abs(state.highlightX - state.targetHighlightX) < .001 && Math.abs(state.vHighlightX) < .004 &&
      Math.abs(state.highlightY - state.targetHighlightY) < .001 && Math.abs(state.vHighlightY) < .004 &&
      Math.abs(state.wobbleX) < .00015 && Math.abs(state.vWobbleX) < .0015 &&
      Math.abs(state.wobbleY) < .00015 && Math.abs(state.vWobbleY) < .0015;
  }

  function paint(control, state){
    var scaleX = Math.max(.94, state.scale + state.wobbleX);
    var scaleY = Math.max(.94, state.scale + state.wobbleY);
    control.style.translate = state.x.toFixed(3) + 'px ' + state.y.toFixed(3) + 'px';
    control.style.scale = scaleX.toFixed(4) + ' ' + scaleY.toFixed(4);
    control.style.transform = 'none';
    control.style.setProperty('--lg-highlight-x', (state.highlightX * 100).toFixed(2) + '%');
    control.style.setProperty('--lg-highlight-y', (state.highlightY * 100).toFixed(2) + '%');
  }

  function clearIdleStyles(control){
    control.classList.remove('is-lg-animating');
    control.style.translate = '';
    control.style.scale = '';
    control.style.transform = '';
    control.style.removeProperty('--lg-highlight-x');
    control.style.removeProperty('--lg-highlight-y');
  }

  function tick(now){
    frame = 0;
    var dt = Math.min((now - lastFrame) / 1000, .032);
    lastFrame = now;
    var steps = Math.max(1, Math.ceil(dt / .008));
    var stepDt = dt / steps;

    animating.forEach(function(control){
      var state = states.get(control);
      for (var i = 0; i < steps; i++){
        spring(state, 'x', 'vx', 'targetX', 270, 27, stepDt);
        spring(state, 'y', 'vy', 'targetY', 270, 27, stepDt);
        spring(state, 'scale', 'vScale', 'targetScale', 400, 24, stepDt);
        spring(state, 'highlightX', 'vHighlightX', 'targetHighlightX', 190, 24, stepDt);
        spring(state, 'highlightY', 'vHighlightY', 'targetHighlightY', 190, 24, stepDt);
        spring(state, 'wobbleX', 'vWobbleX', 'targetWobbleX', 250, 19, stepDt);
        spring(state, 'wobbleY', 'vWobbleY', 'targetWobbleY', 250, 19, stepDt);
        state.targetWobbleX *= Math.exp(-18 * stepDt);
        state.targetWobbleY *= Math.exp(-18 * stepDt);
      }

      paint(control, state);
      if (isSettled(state)){
        control.classList.remove('is-lg-animating');
        if (!state.hovered && !state.focused && !state.pressed) clearIdleStyles(control);
        animating.delete(control);
      }
    });

    if (animating.size) frame = requestAnimationFrame(tick);
  }

  function setRestTarget(state){
    state.targetScale = state.pressed ? state.pressScale :
      (state.hovered ? state.hoverScale : (state.focused ? state.focusScale : 1));
    if (!state.hovered){
      state.targetX = 0;
      state.targetY = 0;
      state.targetHighlightX = .5;
      state.targetHighlightY = .35;
      state.targetWobbleX = 0;
      state.targetWobbleY = 0;
    }
  }

  function updatePointer(control, event){
    var state = states.get(control);
    var rect = control.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    var nx = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width - .5) * 2));
    var ny = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height - .5) * 2));
    state.targetHighlightX = nx * .42 + .5;
    state.targetHighlightY = ny * .42 + .5;

    if (reducedQuery.matches) return;

    if (finePointerQuery.matches){
      var magneticTravel = state.pressed ? state.magnet * .43 : state.magnet;
      state.targetX = nx * magneticTravel;
      state.targetY = ny * magneticTravel;

      var now = performance.now();
      if (state.lastPointerTime){
        var elapsed = Math.max(8, Math.min(32, now - state.lastPointerTime));
        var velocityX = (event.clientX - state.lastPointerX) / elapsed;
        var velocityY = (event.clientY - state.lastPointerY) / elapsed;
        var speed = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
        if (speed > .08){
          var stretch = Math.min(.024, Math.pow(speed, .72) * .0105) * state.wobble;
          var axisTotal = Math.abs(velocityX) + Math.abs(velocityY) || 1;
          var xShare = Math.abs(velocityX) / axisTotal;
          var yShare = Math.abs(velocityY) / axisTotal;
          state.targetWobbleX = stretch * xShare - stretch * .32 * yShare;
          state.targetWobbleY = stretch * yShare - stretch * .32 * xShare;
        }
      }
      state.lastPointerX = event.clientX;
      state.lastPointerY = event.clientY;
      state.lastPointerTime = now;
    }
    activate(control);
  }

  function press(control, pointerId, event){
    var state = states.get(control);
    state.pressed = true;
    state.targetScale = reducedQuery.matches ? .99 : state.pressScale;
    control.classList.add('is-lg-pressed');
    if (event) updatePointer(control, event);
    if (pointerId != null) pressedPointers.set(pointerId, control);
    if (!reducedQuery.matches) activate(control);
  }

  function release(control, pointerId){
    if (!control || !states.has(control)) return;
    var state = states.get(control);
    state.pressed = false;
    control.classList.remove('is-lg-pressed');
    setRestTarget(state);
    if (pointerId != null) pressedPointers.delete(pointerId);
    if (reducedQuery.matches){
      control.style.scale = '';
    } else {
      activate(control);
    }
  }

  document.addEventListener('pointerover', function(event){
    var control = controlFrom(event.target);
    if (!control || control.contains(event.relatedTarget)) return;
    var state = states.get(control);
    if (finePointerQuery.matches && event.pointerType !== 'touch'){
      state.hovered = true;
      state.targetScale = state.pressed ? state.pressScale : state.hoverScale;
      control.classList.add('is-lg-hovered');
      updatePointer(control, event);
    }
  });

  document.addEventListener('pointermove', function(event){
    var control = pressedPointers.get(event.pointerId) || controlFrom(event.target);
    if (!control) return;
    var state = states.get(control);
    if (state.hovered || state.pressed) updatePointer(control, event);
  }, { passive:true });

  document.addEventListener('pointerout', function(event){
    var control = controlFrom(event.target);
    if (!control || control.contains(event.relatedTarget)) return;
    var state = states.get(control);
    state.hovered = false;
    state.lastPointerTime = 0;
    control.classList.remove('is-lg-hovered');
    setRestTarget(state);
    if (!reducedQuery.matches) activate(control);
  });

  document.addEventListener('pointerdown', function(event){
    var control = controlFrom(event.target);
    if (!control || event.button !== 0) return;
    press(control, event.pointerId, event);
  });

  document.addEventListener('pointerup', function(event){
    release(pressedPointers.get(event.pointerId), event.pointerId);
  });

  document.addEventListener('pointercancel', function(event){
    release(pressedPointers.get(event.pointerId), event.pointerId);
  });

  document.addEventListener('focusin', function(event){
    var control = controlFrom(event.target);
    if (!control) return;
    var state = states.get(control);
    state.focused = true;
    state.targetScale = state.pressed ? (reducedQuery.matches ? .99 : state.pressScale) :
      (reducedQuery.matches ? 1 : state.focusScale);
    control.classList.add('is-lg-focused');
    if (!reducedQuery.matches) activate(control);
  });

  document.addEventListener('focusout', function(event){
    var control = controlFrom(event.target);
    if (!control) return;
    var state = states.get(control);
    state.focused = false;
    control.classList.remove('is-lg-focused');
    setRestTarget(state);
    if (!reducedQuery.matches) activate(control);
  });

  document.addEventListener('keydown', function(event){
    if (event.key !== 'Enter' && event.key !== ' ') return;
    var control = controlFrom(event.target);
    if (!control || event.repeat) return;
    press(control, null, null);
  });

  document.addEventListener('keyup', function(event){
    if (event.key !== 'Enter' && event.key !== ' ') return;
    release(controlFrom(event.target), null);
  });

  function resetForMotionPreference(){
    if (reducedQuery.matches){
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      animating.clear();
    }
    controls.forEach(function(control){
      var state = states.get(control);
      state.x = state.targetX = 0;
      state.y = state.targetY = 0;
      state.wobbleX = state.targetWobbleX = 0;
      state.wobbleY = state.targetWobbleY = 0;
      state.scale = 1;
      setRestTarget(state);
      if (reducedQuery.matches){
        clearIdleStyles(control);
      } else if (state.hovered || state.focused || state.pressed){
        activate(control);
      }
    });
  }

  if (reducedQuery.addEventListener) reducedQuery.addEventListener('change', resetForMotionPreference);
  else reducedQuery.addListener(resetForMotionPreference);

  window.addEventListener('pagehide', function(){
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    animating.clear();
    pressedPointers.clear();
  }, { once:true });
})();
