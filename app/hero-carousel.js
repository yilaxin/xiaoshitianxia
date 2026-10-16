(function () {
  'use strict';
  const interval = 5000;
  const duration = 900;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const baseRender = render;
  let session = null;
  let current = null;
  let remaining = [];

  function collection() {
    const photos = new Map(state.dishes.map(dish => [dish.id, new Set(dish.cover ? [dish.cover] : [])]));
    for (const record of state.records) {
      const entries = photos.get(record.dishId);
      if (entries) record.photos.filter(Boolean).forEach(photo => entries.add(photo));
    }
    return state.dishes.map(dish => ({ dish, photos: [...photos.get(dish.id)] })).filter(entry => entry.photos.length);
  }

  function choose(pool) {
    // Shuffle dishes in rounds so every dish gets a turn, without back-to-back repeats.
    let choices = pool.filter(entry => entry.photos.some(photo => photo !== current?.photo));
    if (!choices.length) choices = pool;
    const differentDishes = choices.filter(entry => entry.dish.id !== current?.id);
    if (differentDishes.length) choices = differentDishes;
    const eligible = new Set(choices.map(entry => entry.dish.id));
    if (!remaining.some(id => eligible.has(id))) {
      remaining = pool.map(entry => entry.dish.id);
      for (let i = remaining.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
      }
    }
    const index = remaining.findIndex(id => eligible.has(id));
    const id = remaining.splice(index, 1)[0];
    const entry = choices.find(item => item.dish.id === id);
    let photos = entry.photos.filter(photo => photo !== current?.photo);
    if (!photos.length) photos = entry.photos;
    return { id, photo: photos[Math.floor(Math.random() * photos.length)] };
  }

  function slide(item) {
    const dish = dishBy(item.id);
    const element = document.createElement('span');
    element.className = 'hero-slide';
    element.dataset.dishId = item.id;
    element.setAttribute('aria-hidden', 'true');
    const photo = new Image();
    photo.alt = '';
    photo.src = img(item.photo);
    photo.draggable = false;
    const caption = document.createElement('span');
    caption.className = 'hero-caption';
    caption.innerHTML = `<span><b></b><small></small></span><span class="round-arrow">${icon('arrow')}</span>`;
    caption.querySelector('b').textContent = dish.name;
    caption.querySelector('small').textContent = '今日翻到 · ' + (dish.category || '我的美食收藏');
    element.append(photo, caption);
    return element;
  }

  function setTarget(button, item) {
    button.dataset.action = 'openDish';
    button.dataset.id = item.id;
    button.setAttribute('aria-label', '查看' + dishBy(item.id).name);
  }

  function stop() {
    if (!session) return;
    clearTimeout(session.timer);
    session.animations.forEach(animation => animation.cancel());
    session = null;
  }

  function paused() { return document.hidden || !!document.querySelector('dialog[open]'); }

  function schedule(active, delay = interval) {
    clearTimeout(active.timer);
    if (active !== session || paused() || active.pool.reduce((sum, entry) => sum + entry.photos.length, 0) < 2) return;
    active.timer = setTimeout(() => advance(active), delay);
  }

  async function advance(active) {
    if (active !== session || paused()) return;
    const next = choose(active.pool);
    const incoming = slide(next);
    const photo = incoming.querySelector('img');
    try { await photo.decode(); } catch {
      // Keep the current image visible if a photo cannot decode.
      if (active === session) schedule(active);
      return;
    }
    if (active !== session || paused()) return;
    const started = performance.now();
    const outgoing = active.button.querySelector('.hero-slide');
    incoming.classList.add('hero-slide-incoming');
    active.button.append(incoming);
    active.next = { item: next, element: incoming };
    function finish() {
      if (active !== session) return;
      outgoing.remove();
      incoming.classList.remove('hero-slide-incoming');
      active.animations.forEach(animation => animation.cancel());
      active.animations = [];
      current = next;
      active.next = null;
      active.finish = null;
      setTarget(active.button, current);
      schedule(active, Math.max(0, interval - (performance.now() - started)));
    }
    active.finish = finish;
    if (reducedMotion.matches) { finish(); return; }
    const fade = incoming.animate([{ opacity: 0 }, { opacity: 1 }], { duration, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'both' });
    const captionOut = outgoing.querySelector('.hero-caption').animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: 'both' });
    const captionIn = incoming.querySelector('.hero-caption').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 550, delay: 250, fill: 'both' });
    active.animations = [fade, captionOut, captionIn];
    active.animations.forEach(animation => { animation.id = 'xstx-hero-crossfade'; animation.finished.catch(() => {}); });
    fade.finished.then(finish, () => {});
  }

  function mount() {
    const button = document.querySelector('.hero-image');
    if (!button) return;
    button.classList.add('hero-carousel');
    button.setAttribute('aria-live', 'off');
    const pool = collection();
    if (!pool.length) {
      current = null;
      remaining = [];
      const dish = state.dishes[0];
      button.innerHTML = `<img src="${img('')}" alt="照片待补充"><span class="hero-caption"><span><b>${dish ? '好味道，等一张照片' : '下一道美味，等你记录'}</b><small>${dish ? '补上照片，让美味成为封面' : '记下属于你的美食时光'}</small></span><span class="round-arrow">${icon('arrow')}</span></span>`;
      if (dish) setTarget(button, { id: dish.id });
      else { button.dataset.action = 'add'; button.setAttribute('aria-label', '记下一道美味'); }
      return;
    }
    if (!pool.some(entry => entry.dish.id === current?.id && entry.photos.includes(current.photo))) current = choose(pool);
    button.replaceChildren(slide(current));
    setTarget(button, current);
    const active = { button, pool, timer: null, animations: [], next: null, finish: null };
    session = active;
    // During a blend, open whichever image is visually dominant at the click.
    button.addEventListener('click', () => {
      if (active !== session) return;
      const next = active.next;
      setTarget(button, next && Number(getComputedStyle(next.element).opacity) >= .5 ? next.item : current);
    }, true);
    schedule(active);
  }

  function resume() {
    if (!session) return;
    clearTimeout(session.timer);
    if (paused()) {
      session.animations.forEach(animation => animation.pause());
    } else if (session.next) {
      session.animations.forEach(animation => animation.play());
    } else schedule(session);
  }

  render = function () { stop(); baseRender(); mount(); };
  document.addEventListener('visibilitychange', resume);
  // A detail/form dialog freezes the cover; closing it starts a fresh five seconds.
  const observer = new MutationObserver(resume);
  document.querySelectorAll('dialog').forEach(dialog => observer.observe(dialog, { attributes: true, attributeFilter: ['open'] }));
  reducedMotion.addEventListener('change', () => { if (reducedMotion.matches && session?.next) session.finish(); });
  mount();
})();
