(function () {
  'use strict';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const active = new Set();
  const baseRender = render;
  const baseRefreshGrid = refreshGrid;
  let previous = null;

  function finishMotion() {
    for (const animation of active) animation.cancel();
    active.clear();
  }

  function enter(elements, { distance = 9, duration = 300, stagger = 28 } = {}) {
    if (reducedMotion.matches) return;
    [...elements].filter(Boolean).forEach((element, index) => {
      // Keep the book stage stationary: its spine animation measures its geometry.
      const offset = element.classList.contains('book-stage') ? 0 : distance;
      const animation = element.animate([
        { opacity: .25, transform: `translateY(${offset}px)` },
        { opacity: 1, transform: 'translateY(0)' }
      ], { duration, delay: Math.min(index * stagger, 84), easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards' });
      animation.id = 'xstx-page-entry';
      active.add(animation);
      animation.finished.then(() => active.delete(animation), () => active.delete(animation));
    });
  }

  render = function () {
    finishMotion();
    const next = { view, month: `${year}-${month}`, date: selectedDate, menu: `${category}|${favOnly}|${query}|${sort}` };
    const last = previous;
    baseRender();
    previous = next;
    const main = document.getElementById('main');
    if (!last || last.view !== next.view) {
      enter([...main.children].filter(element => !element.matches('.page-foot,.collection-kicker,.book-tip')), {});
    } else if (view === 'calendar') {
      if (last.month !== next.month) enter(main.querySelectorAll('.calendar-box,.day-panel'), { distance: 5, duration: 230 });
      else if (last.date !== next.date) enter(main.querySelectorAll('.day-panel'), { distance: 5, duration: 200 });
    } else if (['menu', 'favorites'].includes(view) && last.menu !== next.menu) {
      enter(main.querySelectorAll('#foodGrid'), { distance: 5, duration: 180 });
    }
  };

  refreshGrid = function () {
    finishMotion();
    baseRefreshGrid();
    if (['menu', 'favorites'].includes(view)) enter(document.querySelectorAll('#foodGrid'), { distance: 0, duration: 160 });
  };

  // New input wins immediately. Rapid navigation never queues animations or blocks controls.
  document.addEventListener('click', finishMotion, true);
  document.addEventListener('keydown', finishMotion, true);
  reducedMotion.addEventListener('change', finishMotion);
  render();
})();
