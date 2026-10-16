(function () {
  'use strict';
  const baseRender = render;
  const enterIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/></svg>';
  const exitIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8h5V3m8 0v5h5M8 21v-5H3m18 0h-5v5"/></svg>';
  let fullscreen = false;
  let desired = false;
  let awaitingNative = false;
  let savedScroll = 0;

  function restoreScroll() {
    requestAnimationFrame(() => {
      if (!fullscreen) window.scrollTo(0, savedScroll);
    });
  }

  function sync() {
    document.body.classList.toggle('book-fullscreen', fullscreen);
    const button = document.querySelector('[data-action="bookFullscreen"]');
    if (button) {
      button.innerHTML = (fullscreen ? exitIcon : enterIcon) + (fullscreen ? '退出全屏' : '全屏翻阅');
      button.setAttribute('aria-pressed', String(fullscreen));
      button.setAttribute('aria-label', fullscreen ? '退出全屏翻阅（Esc）' : '全屏翻阅（F11）');
      button.title = fullscreen ? '按 Esc 或 F11 退出全屏' : '全屏翻阅 · F11';
      button.disabled = !fullscreen && bookBusy;
    }
    const tip = document.querySelector('.book-tip');
    if (tip) tip.innerHTML = fullscreen
      ? `${icon('book')} ${bookCover ? '点击封面翻开书页 · ' : '← → 翻页 · '}Esc 退出全屏`
      : `${icon('book')} ${bookCover ? '点击封面，翻开属于你的私人菜单。' : '使用键盘 ← → 翻页，也可以从目录直接找到喜欢的菜。'}`;
  }

  function apply(enabled) {
    if (fullscreen === enabled) { sync(); return; }
    if (enabled) savedScroll = window.scrollY;
    fullscreen = enabled;
    // Settle any moving paper before its measured geometry changes.
    if (bookBusy) window.dispatchEvent(new Event('resize'));
    sync();
    if (enabled) window.scrollTo(0, 0);
    else restoreScroll();
  }

  function request(enabled) {
    desired = enabled && view === 'book';
    awaitingNative = true;
    apply(desired);
    try {
      const actual = window.desktop.setBookFullscreen(desired);
      if (actual === desired) awaitingNative = false;
    } catch (error) {
      awaitingNative = false;
      desired = false;
      apply(false);
      toast('全屏未完成：' + error.message);
    }
  }

  function mount() {
    const toolbar = document.querySelector('.book-toolbar');
    if (!toolbar) return;
    if (!toolbar.querySelector('[data-action="bookFullscreen"]')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn outline small book-fullscreen-toggle';
      button.dataset.action = 'bookFullscreen';
      toolbar.append(button);
    }
    sync();
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-action="bookFullscreen"]');
    if (!button || button.disabled || view !== 'book') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    request(!fullscreen);
  }, true);
  document.addEventListener('keydown', event => {
    if (view !== 'book' || document.querySelector('dialog[open]')) return;
    if (event.key === 'F11' || (event.key === 'Escape' && fullscreen)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.repeat || (!fullscreen && bookBusy)) return;
      request(event.key === 'Escape' ? false : !fullscreen);
    }
  }, true);

  window.desktop.onFullscreenChange(enabled => {
    if (enabled !== window.desktop.isFullscreen()) return;
    if (view !== 'book' && enabled) { request(false); return; }
    if (awaitingNative && enabled !== desired) {
      // A fast enter/exit can deliver the earlier native event after the next request.
      try { window.desktop.setBookFullscreen(desired); } catch { /* Request path reports errors. */ }
      return;
    }
    awaitingNative = false;
    desired = enabled;
    apply(enabled);
    if (!enabled) restoreScroll();
  });
  render = function () {
    if (view !== 'book' && (fullscreen || desired)) request(false);
    baseRender();
    mount();
  };
  // Reloading while in native fullscreen must still leave a usable normal home page.
  if (window.desktop.isFullscreen()) request(false);
  mount();
})();
