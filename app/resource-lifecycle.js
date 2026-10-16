(function () {
  'use strict';
  // A closed native dialog stays in the DOM. Drop its images, handlers and form values
  // after feature-specific close handlers run, unless it has already been reopened.
  for (const dialog of document.querySelectorAll('dialog')) {
    dialog.addEventListener('close', () => {
      if (dialog.open) return;
      dialog.replaceChildren();
    });
  }

  // Chromium can keep a wheel gesture latched to the previous page's compositor
  // after a 3D turn. Hand an edge gesture to the document without a dead interval.
  document.addEventListener('wheel', event => {
    if (view !== 'book' || bookBusy || document.body.classList.contains('book-fullscreen') ||
        event.defaultPrevented || event.ctrlKey || event.shiftKey || !event.deltaY ||
        Math.abs(event.deltaX) > Math.abs(event.deltaY) || document.querySelector('dialog[open]')) return;
    const hit = document.elementFromPoint(event.clientX,event.clientY) || event.target;
    const page = hit.closest('#bookSpread>.book-right,#bookSpread>.chapter-sheet');
    if (!page || !/auto|scroll/.test(getComputedStyle(page).overflowY)) return;
    const max = page.scrollHeight - page.clientHeight;
    const atEdge = event.deltaY < 0 ? page.scrollTop <= 1 : page.scrollTop >= max - 1;
    const root = document.scrollingElement;
    if (!atEdge || (event.deltaY < 0 ? root.scrollTop <= 0 : root.scrollTop + innerHeight >= root.scrollHeight - 1)) return;
    const unit = event.deltaMode === 1 ? parseFloat(getComputedStyle(page).lineHeight) || 16 : event.deltaMode === 2 ? innerHeight : 1;
    event.preventDefault();
    window.scrollBy({top:event.deltaY * unit,behavior:'instant'});
  }, {passive:false,capture:true});
})();
