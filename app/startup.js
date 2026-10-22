(function () {
  'use strict';
  const DURATION = 2600;
  const PREP_TIMEOUT_MS = 5000;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let intro = document.getElementById('startupIntro');
  let app = document.querySelector('.app');
  let book = document.querySelector('.startup-book');
  let cover = document.querySelector('.startup-cover');
  let page = document.querySelector('.startup-page');
  let skipBtn = document.querySelector('[data-action="skipStartup"]');
  let openBtn = document.querySelector('[data-action="openStartup"]');
  let bridge = document.querySelector('.startup-paper-bridge');
  let logo = document.querySelector('[data-startup-logo]');
  let shadow = document.querySelector('.startup-shadow');
  let pageShadow = document.querySelector('.startup-page-shadow');

  let active = false;
  let phase = 'idle';
  let started = false;
  let finished = false;
  let cleanupDone = false;
  let watchdog = 0;
  let prepWatchdog = 0;
  let animations = [];
  let frame = 0;
  let bound = false;
  let previousOverflow = { html: '', body: '' };
  let cancelLogoWait = null;
  let previousFocus = null;
  // Renderer-local monotonic timestamps distinguish timeout protection from
  // an earlier preparation failure, and do not depend on test-runner latency.
  const timing = { preparationStartedAt: null, animationStartedAt: null, finishedAt: null, reason: null, detail: null };

  if (intro) intro.setAttribute('data-phase', phase);

  function clearTimers() {
    if (frame) { cancelAnimationFrame(frame); frame = 0; }
    if (watchdog) { clearTimeout(watchdog); watchdog = 0; }
    if (prepWatchdog) { clearTimeout(prepWatchdog); prepWatchdog = 0; }
  }

  function cancelAnimations() {
    animations.forEach((animation) => {
      try { animation.cancel(); } catch (error) {}
    });
    animations = [];
  }

  function addAnimation(animation) {
    if (animation) {
      animation.pause();
      animations.push(animation);
    }
    return animation;
  }

  function playTimeline(last, reduced) {
    // Begin every effect on one rendered frame, then use that animation's
    // clock for stages and completion. Wall-clock timers can otherwise remove
    // the overlay before a delayed first composition has finished fading it.
    frame = requestAnimationFrame(() => {
      if (cleanupDone) return;
      const origin = document.timeline.currentTime;
      timing.animationStartedAt = performance.now();
      for (const animation of animations) {
        animation.play();
        animation.startTime = origin;
      }
      let scrollRestored = reduced;
      const update = () => {
        if (cleanupDone) return;
        const elapsed = Number(last.currentTime) || 0;
        if (!reduced) {
          const next = elapsed < 80 ? 'arriving' : elapsed < 1300 ? 'opening' : elapsed < 1800 ? 'settling' : 'revealing';
          if (phase !== next) setPhase(next);
          if (!scrollRestored && elapsed >= 1700) { restoreScroll(); scrollRestored = true; }
        }
        frame = requestAnimationFrame(update);
      };
      update();
      last.finished.then(() => cleanup()).catch(() => {
        if (!cleanupDone) skip('animation-interrupted');
      });
    });
  }

  function setPhase(next) {
    phase = next;
    if (intro) intro.setAttribute('data-phase', next);
  }

  function unlock() {
    document.documentElement.classList.remove('startup-active');
    if (app) app.inert = false;
    restoreScroll();
  }

  function restoreScroll() {
    document.documentElement.classList.remove('startup-scroll-locked');
    document.documentElement.style.overflow = previousOverflow.html || '';
    document.body.style.overflow = previousOverflow.body || '';
  }

  function blockScroll(event) { event.preventDefault(); }

  function removeListeners() {
    document.removeEventListener('keydown', onKeydown, true);
    window.removeEventListener('resize', onResize);
    if (reduceMotion.removeEventListener) reduceMotion.removeEventListener('change', onReducedChange);
    else if (reduceMotion.removeListener) reduceMotion.removeListener(onReducedChange);
    if (skipBtn) skipBtn.removeEventListener('click', onSkipClick);
    if (openBtn) openBtn.removeEventListener('click', onOpenClick);
    if (intro) {
      intro.removeEventListener('wheel', blockScroll);
      intro.removeEventListener('touchmove', blockScroll);
    }
  }

  function cleanup(reason = 'complete', detail = null) {
    if (cleanupDone) return;
    timing.finishedAt = performance.now();
    timing.reason = reason;
    timing.detail = detail;
    cleanupDone = true;
    active = false;
    finished = true;
    phase = 'done';
    clearTimers();
    cancelAnimations();
    if (cancelLogoWait) {
      const cancel = cancelLogoWait;
      cancelLogoWait = null;
      cancel();
    }
    removeListeners();
    unlock();
    const restoreFocus = intro && intro.contains(document.activeElement);
    const element = document.getElementById('startupIntro');
    if (element) element.remove();
    if (restoreFocus) {
      const target = previousFocus && previousFocus.isConnected && previousFocus !== document.body
        ? previousFocus : document.querySelector('.nav [data-view="menu"]');
      if (target) target.focus({ preventScroll: true });
    }
    intro = null;
    book = null;
    cover = null;
    page = null;
    skipBtn = null;
    openBtn = null;
    bridge = null;
    previousFocus = null;
    logo = null;
    shadow = null;
    pageShadow = null;
  }

  function onKeydown(event) {
    if (finished || cleanupDone || !document.getElementById('startupIntro')) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      skip('escape');
    }
    if (event.key === 'Tab' && active) {
      const targets = [openBtn, skipBtn].filter(el => el && !el.disabled);
      const index = targets.indexOf(document.activeElement);
      if (targets.length) {
        event.preventDefault();
        targets[(index + (event.shiftKey ? -1 : 1) + targets.length) % targets.length].focus();
      }
    }
  }

  function onResize() {
    // A waiting cover responds through CSS. An in-flight viewport expansion
    // cannot retain its old geometry after resizing; safely reveal the home.
    if (started && active) skip('resize');
  }

  function onReducedChange() {
    if (reduceMotion.matches && started && active && !cleanupDone) skip('reduced-motion');
  }

  function onSkipClick(event) {
    if (event) event.preventDefault();
    if (finished || cleanupDone) return;
    skip('button');
  }

  function onOpenClick(event) {
    if (event) event.preventDefault();
    start();
  }

  function bindListeners() {
    if (bound || !intro) return;
    bound = true;
    document.addEventListener('keydown', onKeydown, true);
    window.addEventListener('resize', onResize);
    if (reduceMotion.addEventListener) reduceMotion.addEventListener('change', onReducedChange);
    else if (reduceMotion.addListener) reduceMotion.addListener(onReducedChange);
    if (skipBtn) skipBtn.addEventListener('click', onSkipClick);
    if (openBtn) openBtn.addEventListener('click', onOpenClick);
    intro.addEventListener('wheel', blockScroll, { passive: false });
    intro.addEventListener('touchmove', blockScroll, { passive: false });
  }

  function assetLogo() {
    const assets = globalThis.XSTX_ASSETS || globalThis.ASSETS || window.XSTX_ASSETS || window.ASSETS;
    return assets && assets.logo ? assets.logo : null;
  }

  function setLogoSource() {
    if (!logo) return null;
    let src = logo.getAttribute('src') || logo.dataset.startupLogoSrc || '';
    if (!src || src.indexOf('__STARTUP_LOGO__') !== -1) {
      const fallback = assetLogo();
      if (fallback) {
        src = fallback;
        logo.setAttribute('src', src);
      }
    }
    return src;
  }

  function waitForLogo() {
    if (!logo) return Promise.reject(new Error('startup logo element missing'));
    const src = setLogoSource();
    if (!src || src.indexOf('__STARTUP_LOGO__') !== -1) {
      return Promise.reject(new Error('startup logo source missing'));
    }
    const img = logo;
    return new Promise((resolve, reject) => {
      let settled = false;
      const clear = () => {
        img.removeEventListener('load', onLoad);
        img.removeEventListener('error', onError);
      };
      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        clear();
        if (cancelLogoWait === cancel) cancelLogoWait = null;
        fn(value);
      };
      const onLoad = () => finish(resolve);
      const onError = () => finish(reject, new Error('startup logo failed to decode'));
      const cancel = () => finish(reject, new Error('startup logo wait cancelled'));
      cancelLogoWait = cancel;
      if (img.complete && img.naturalWidth > 0) {
        finish(resolve);
        return;
      }
      img.addEventListener('load', onLoad);
      img.addEventListener('error', onError);
      if (typeof img.decode === 'function') {
        img.decode().then(onLoad).catch(() => {
          // decode() can reject during a renderer/media change even though
          // the image request is still valid. Trust load/error for pending
          // requests; the preparation watchdog still bounds a stalled load.
          if (img.complete && img.naturalWidth > 0) onLoad();
        });
      }
    });
  }

  function nativeMode() {
    try {
      if (window.desktop && window.desktop.startup && typeof window.desktop.startup.mode === 'function') {
        return window.desktop.startup.mode();
      }
    } catch (error) {}
    return null;
  }

  function nativeClaim() {
    try {
      if (window.desktop && window.desktop.startup && typeof window.desktop.startup.claim === 'function') {
        return window.desktop.startup.claim();
      }
    } catch (error) {}
    return null;
  }

  function waitForShown() {
    try {
      if (window.desktop && window.desktop.startup && typeof window.desktop.startup.whenShown === 'function') {
        return window.desktop.startup.whenShown().then((signal) => {
          if (signal && signal.enabled === false) throw new Error('startup disabled by desktop');
          return signal;
        });
      }
    } catch (error) {
      return Promise.reject(error);
    }
    return Promise.reject(new Error('startup native handshake unavailable'));
  }

  function runReduced() {
    restoreScroll();
    setPhase('revealing');
    addAnimation(intro.animate([{ opacity: 1 }, { opacity: 0 }],
      { duration: 200, easing: 'ease-out', fill: 'both' }));
    return addAnimation(app.animate([{ opacity: 0 }, { opacity: 1 }],
      { duration: 200, easing: 'ease-out', fill: 'both' }));
  }

  function runFull() {
    setPhase('arriving');
    const ambience = document.querySelector('.startup-ambience');
    if (ambience) addAnimation(ambience.animate([{ opacity: 1 }, { opacity: 0 }],
      { duration: 450, easing: 'ease-in-out', fill: 'both' }));

    const closedShift = book ? book.offsetWidth / 4 : 0;
    // The stationary cover and its hinge share one easing and timeline.
    addAnimation(book ? book.animate([
      { transform: 'translateX(' + (-closedShift).toFixed(2) + 'px)' },
      { transform: 'translateX(0px)' }
    ], { duration: 1220, delay: 80, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'both' }) : null);

    addAnimation(cover ? cover.animate([
      { transform: 'rotateY(0deg)' },
      { transform: 'rotateY(-180deg)' }
    ], { duration: 1220, delay: 80, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'both' }) : null);

    addAnimation(page ? page.animate([
      { opacity: .85, transform: 'perspective(1200px) rotateY(2deg) translateY(5px)' },
      { opacity: 1, transform: 'perspective(1200px) rotateY(0deg) translateY(0)' }
    ], { duration: 350, delay: 1000, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'both' }) : null);

    addAnimation(pageShadow ? pageShadow.animate([
      { opacity: .22 },
      { opacity: .08 }
    ], { duration: 350, delay: 1000, easing: 'ease-out', fill: 'both' }) : null);

    addAnimation(shadow ? shadow.animate([
      { opacity: .26, transform: 'translate(-50%,-50%) scale(.9)' },
      { opacity: .5, transform: 'translate(-50%,-50%) scale(1.04)' }
    ], { duration: 1220, delay: 80, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'both' }) : null);

    // Expand the opened paper into the same textured paper as the home.
    // The home stays fully rendered in place: no render(), zoom or relayout.
    const rect = page.getBoundingClientRect();
    Object.assign(bridge.style, {
      left: (rect.left + closedShift) + 'px', top: rect.top + 'px',
      width: rect.width + 'px', height: rect.height + 'px'
    });
    addAnimation(bridge.animate([
      { opacity: 0, offset: 0 }, { opacity: 1, offset: .2 }, { opacity: 1 }
    ], { duration: 350, delay: 1450, fill: 'both' }));
    addAnimation(bridge.animate([
      { left: (rect.left + closedShift) + 'px', top: rect.top + 'px', width: rect.width + 'px', height: rect.height + 'px', borderRadius: '6px 14px 14px 6px' },
      { left: '0px', top: '0px', width: innerWidth + 'px', height: innerHeight + 'px', borderRadius: '0px' }
    ], { duration: 350, delay: 1450, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'both' }));
    for (const element of [book, shadow]) {
      if (element) addAnimation(element.animate([{ opacity: 1 }, { opacity: 0 }],
        { duration: 350, delay: 1450, easing: 'ease-in-out', fill: 'both' }));
    }
    const reveal = addAnimation(app.animate([{ opacity: 0 }, { opacity: 1 }],
      { duration: 800, delay: 1800, easing: 'ease-in-out', fill: 'both' }));

    addAnimation(intro ? intro.animate([
      { opacity: 1 },
      { opacity: 0 }
    ], { duration: 800, delay: 1800, easing: 'ease-in-out', fill: 'both' }) : null);

    return reveal;
  }

  function start() {
    if (started || finished || cleanupDone || phase !== 'waiting') return false;
    started = true;
    openBtn.disabled = true;
    openBtn.setAttribute('aria-label', '正在翻开笑食天下');
    const reduced = reduceMotion.matches;
    playTimeline(reduced ? runReduced() : runFull(), reduced);
    watchdog = setTimeout(() => skip('watchdog'), 5000);
    return true;
  }

  function prepare() {
    if (finished || cleanupDone) return;
    active = true;
    setPhase('waiting');
    if (prepWatchdog) { clearTimeout(prepWatchdog); prepWatchdog = 0; }
    previousOverflow = {
      html: document.documentElement.style.overflow || '',
      body: document.body.style.overflow || ''
    };
    document.documentElement.classList.add('startup-active', 'startup-scroll-locked');
    previousFocus = document.activeElement;
    if (app) app.inert = true;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    intro.setAttribute('aria-hidden', 'false');
    intro.classList.add('is-ready');
    bindListeners();
    openBtn.focus({ preventScroll: true });
    // No timeout while intentionally waiting for the user to open the cover.
  }

  function skip(reason) {
    if (finished || cleanupDone) return false;
    started = true;
    cleanup(reason || 'skip');
    return true;
  }

  const StartupIntro = {
    start: start,
    skip: skip,
    get active() { return active; },
    get phase() { return phase; },
    get duration() { return DURATION; },
    get timing() { return { ...timing }; }
  };
  globalThis.StartupIntro = StartupIntro;

  function removeOverlayImmediately(reason, detail = null) {
    if (cleanupDone) return;
    started = true;
    finished = true;
    cleanup(reason, detail);
  }

  function boot() {
    if (!intro) return;
    bindListeners();
    timing.preparationStartedAt = performance.now();
    prepWatchdog = setTimeout(() => removeOverlayImmediately('preparation-timeout'), PREP_TIMEOUT_MS);

    const mode = nativeMode();
    if (mode && mode.enabled === false) { removeOverlayImmediately('disabled'); return; }

    const claim = nativeClaim();
    if (claim && claim.first === false) { removeOverlayImmediately('already-played'); return; }

    let enabledByPreference = true;
    try {
      if (typeof state !== 'undefined' && state && state.preferences && state.preferences.startupAnimation === false) {
        enabledByPreference = false;
      }
    } catch (error) {}

    if (!enabledByPreference) { removeOverlayImmediately('disabled'); return; }

    Promise.all([waitForLogo(), waitForShown()])
      .then(() => prepare())
      .catch(error => removeOverlayImmediately('preparation-error', String(error?.message || error)));
  }

  boot();
})();
