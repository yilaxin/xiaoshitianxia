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
  let logo = document.querySelector('[data-startup-logo]');
  let shadow = document.querySelector('.startup-shadow');
  let pageShadow = document.querySelector('.startup-page-shadow');

  let active = false;
  let phase = 'idle';
  let started = false;
  let finished = false;
  let cleanupDone = false;
  let startedAt = 0;
  let watchdog = 0;
  let prepWatchdog = 0;
  let animations = [];
  let timers = [];
  let bound = false;
  let previousOverflow = { html: '', body: '' };
  let cancelLogoWait = null;

  if (intro) intro.setAttribute('data-phase', phase);

  function clearTimers() {
    timers.forEach(clearTimeout);
    timers = [];
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
    if (animation) animations.push(animation);
  }

  function setPhase(next) {
    phase = next;
    if (intro) intro.setAttribute('data-phase', next);
  }

  function unlock() {
    document.documentElement.classList.remove('startup-active');
    if (app) app.inert = false;
    document.documentElement.style.overflow = previousOverflow.html || '';
    document.body.style.overflow = previousOverflow.body || '';
  }

  function removeListeners() {
    document.removeEventListener('keydown', onKeydown, true);
    window.removeEventListener('resize', onResize);
    if (reduceMotion.removeEventListener) reduceMotion.removeEventListener('change', onReducedChange);
    else if (reduceMotion.removeListener) reduceMotion.removeListener(onReducedChange);
    if (skipBtn) skipBtn.removeEventListener('click', onSkipClick);
  }

  function cleanup() {
    if (cleanupDone) return;
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
    const element = document.getElementById('startupIntro');
    if (element) element.remove();
    intro = null;
    book = null;
    cover = null;
    page = null;
    skipBtn = null;
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
  }

  function onResize() {
    // CSS clamps adapt the spread; the animation keeps its own timeline.
    if (book) book.getBoundingClientRect();
  }

  function onReducedChange() {
    if (reduceMotion.matches && active && !cleanupDone) skip('reduced-motion');
  }

  function onSkipClick(event) {
    if (event) event.preventDefault();
    if (finished || cleanupDone) return;
    skip('button');
  }

  function bindListeners() {
    if (bound || !intro) return;
    bound = true;
    document.addEventListener('keydown', onKeydown, true);
    window.addEventListener('resize', onResize);
    if (reduceMotion.addEventListener) reduceMotion.addEventListener('change', onReducedChange);
    else if (reduceMotion.addListener) reduceMotion.addListener(onReducedChange);
    if (skipBtn) skipBtn.addEventListener('click', onSkipClick);
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
        img.decode().then(onLoad).catch(onError);
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
    setPhase('arriving');
    const closedShift = book ? book.offsetWidth / 4 : 0;
    const from = 'translateX(' + (-closedShift * .985).toFixed(2) + 'px) scale(.985)';
    const to = 'translateX(' + (-closedShift).toFixed(2) + 'px) scale(1)';
    addAnimation(book ? book.animate([
      { opacity: 0, transform: from },
      { opacity: 1, transform: to }
    ], { duration: 200, easing: 'ease-out', fill: 'both' }) : null);
    timers.push(setTimeout(() => cleanup(), 220));
  }

  function runFull() {
    setPhase('arriving');

    const closedShift = book ? book.offsetWidth / 4 : 0;
    addAnimation(book ? book.animate([
      { opacity: 0 },
      { opacity: 1 }
    ], { duration: 250, easing: 'ease-out', fill: 'both' }) : null);

    // The closed cover stays centered during arrival; shift the spread only
    // when the hinge starts turning, with the same timeline and easing.
    addAnimation(book ? book.animate([
      { transform: 'translateX(' + (-closedShift).toFixed(2) + 'px)' },
      { transform: 'translateX(0px)' }
    ], { duration: 1250, delay: 250, easing: 'cubic-bezier(.5,.05,.75,.45)', fill: 'both' }) : null);

    addAnimation(cover ? cover.animate([
      { transform: 'rotateY(0deg)' },
      { transform: 'rotateY(-180deg)' }
    ], { duration: 1250, delay: 250, easing: 'cubic-bezier(.5,.05,.75,.45)', fill: 'both' }) : null);

    addAnimation(page ? page.animate([
      { opacity: .72, transform: 'perspective(1200px) rotateY(2deg) translateY(10px)' },
      { opacity: 1, transform: 'perspective(1200px) rotateY(0deg) translateY(0)' }
    ], { duration: 400, delay: 1500, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'both' }) : null);

    addAnimation(pageShadow ? pageShadow.animate([
      { opacity: .22 },
      { opacity: .08 }
    ], { duration: 400, delay: 1500, easing: 'ease-out', fill: 'both' }) : null);

    addAnimation(shadow ? shadow.animate([
      { opacity: .26, transform: 'translate(-50%,-50%) scale(.9)' },
      { opacity: .5, transform: 'translate(-50%,-50%) scale(1.04)' }
    ], { duration: 1250, delay: 250, easing: 'cubic-bezier(.5,.05,.75,.45)', fill: 'both' }) : null);

    addAnimation(intro ? intro.animate([
      { opacity: 1 },
      { opacity: 0 }
    ], { duration: 700, delay: 1900, easing: 'ease', fill: 'both' }) : null);

    timers.push(setTimeout(() => setPhase('opening'), 250));
    timers.push(setTimeout(() => setPhase('settling'), 1500));
    timers.push(setTimeout(() => setPhase('revealing'), 1900));
    timers.push(setTimeout(() => cleanup(), DURATION));
  }

  function start() {
    if (started || finished || cleanupDone) return false;
    if (!document.getElementById('startupIntro')) return false;
    started = true;
    active = true;
    startedAt = performance.now();
    if (prepWatchdog) { clearTimeout(prepWatchdog); prepWatchdog = 0; }
    previousOverflow = {
      html: document.documentElement.style.overflow || '',
      body: document.body.style.overflow || ''
    };
    document.documentElement.classList.add('startup-active');
    if (app) app.inert = true;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    intro.setAttribute('aria-hidden', 'false');
    intro.classList.add('is-ready');
    bindListeners();
    if (reduceMotion.matches) runReduced();
    else runFull();
    watchdog = setTimeout(() => skip('watchdog'), 5000);
    return true;
  }

  function skip(reason) {
    if (finished || cleanupDone) return false;
    started = true;
    cleanup();
    return true;
  }

  const StartupIntro = {
    start: start,
    skip: skip,
    get active() { return active; },
    get phase() { return phase; },
    get duration() { return DURATION; }
  };
  globalThis.StartupIntro = StartupIntro;

  function removeOverlayImmediately() {
    if (cleanupDone) return;
    started = true;
    finished = true;
    cleanup();
  }

  function boot() {
    if (!intro) return;
    bindListeners();
    prepWatchdog = setTimeout(() => removeOverlayImmediately(), PREP_TIMEOUT_MS);

    const mode = nativeMode();
    if (mode && mode.enabled === false) { removeOverlayImmediately(); return; }

    const claim = nativeClaim();
    if (claim && claim.first === false) { removeOverlayImmediately(); return; }

    let enabledByPreference = true;
    try {
      if (typeof state !== 'undefined' && state && state.preferences && state.preferences.startupAnimation === false) {
        enabledByPreference = false;
      }
    } catch (error) {}

    if (!enabledByPreference) { removeOverlayImmediately(); return; }

    Promise.all([waitForLogo(), waitForShown()])
      .then(() => start())
      .catch(() => removeOverlayImmediately());
  }

  boot();
})();
