(function () {
  'use strict';
  // Decorative content has no actions or focus targets. All counts come from the collection.
  const bowlDrawing = `<svg viewBox="0 0 220 200" fill="none" aria-hidden="true"><ellipse cx="109" cy="164" rx="82" ry="12"/><path d="M36 92h146c-5 45-25 66-73 66S42 137 36 92Z"/><ellipse cx="109" cy="92" rx="73" ry="18"/><path d="M57 94c11-13 27-18 52-18s43 5 53 18M85 162h48M83 60c-17-17 14-23 0-42m27 40c-17-17 14-23 0-42m27 44c-17-17 14-23 0-42m18 52 53-26m-51 36 54-26"/><path d="m20 57 4 8m-15-1 9 3m163-48 2 8m7-5-8 4"/></svg>`;
  const baseRender = render;
  const baseCards = renderCards;
  const baseDayPanel = renderDayPanel;

  renderCards = function (dishes) {
    const template = document.createElement('template');
    template.innerHTML = baseCards(dishes);
    template.content.querySelectorAll('.food-card').forEach((card, index) => {
      const dish = dishes[index];
      if (!dish?.tags?.length) return;
      const labels = document.createElement('div');
      labels.className = 'card-flavor-notes';
      labels.innerHTML = dish.tags.slice(0, 2).map(tag => `<span>${esc(tag)}</span>`).join('<i aria-hidden="true">·</i>');
      card.querySelector('.card-bottom').before(labels);
    });
    return template.innerHTML;
  };

  renderDayPanel = function () {
    const template = document.createElement('template');
    template.innerHTML = baseDayPanel();
    const empty = template.content.querySelector('.calendar-empty');
    if (empty) empty.innerHTML = `${bowlDrawing}<p>这一天的菜单，<br>等你来写。</p><small>一碗热汤，一顿家常，<br>都是值得收藏的小事。</small>`;
    return template.innerHTML;
  };

  function enrichPage() {
    const main = document.getElementById('main');
    main.dataset.page = view;
    const chapter = { menu: ['01', '味觉私藏'], favorites: ['05', '心头好味'], book: ['02', '纸上回味'], calendar: ['03', '三餐四季'], settings: ['04', '妥帖珍藏'] }[view];
    const head = main.querySelector('.page-head');
    if (head && !head.querySelector('.folio-mark')) {
      const mark = document.createElement('div');
      mark.className = 'folio-mark';
      mark.setAttribute('aria-hidden', 'true');
      mark.innerHTML = `<span>${chapter[0]}</span><small>${chapter[1]}</small>`;
      head.prepend(mark);
    }
    const hero = main.querySelector('.hero-copy');
    if (hero) hero.insertAdjacentHTML('beforeend', `<div class="hero-still-life" aria-hidden="true"><div class="daily-seal">好好<br>吃饭</div>${bowlDrawing}<span>寻常滋味 · 好好收藏</span></div>`);
    const section = main.querySelector('.section-row');
    if (section) section.insertAdjacentHTML('beforebegin', view === 'favorites'
      ? '<div class="collection-kicker"><span>偏爱之选</span><i></i><small>每次翻到，都还会心动。</small></div>'
      : '<div class="collection-kicker"><span>私藏菜单</span><i></i><small>每一道，都是自己的口味。</small></div>');
    const stage = main.querySelector('.book-stage');
    if (stage) {
      stage.classList.toggle('showing-cover', !!bookCover);
      if (bookCover && bookDishes().length) stage.insertAdjacentHTML('beforeend', `<aside class="reading-margin reading-left"><span class="margin-kicker">味觉藏书室</span><h2>把喜欢的味道<br>装订成册。</h2><p>翻过的是书页，<br>留下的是生活。</p><div class="margin-line"></div><small>一餐一味 · 一页一念</small></aside><aside class="reading-margin reading-right"><div class="reading-sprig" aria-hidden="true"><svg viewBox="0 0 100 140"><path d="M20 132C42 100 58 49 79 9M45 89C15 87 14 62 16 55c23 5 31 16 29 34Zm14-31C43 32 54 16 61 12c11 15 14 32-2 46Zm-20 46c25 4 39-6 43-24-24-1-35 10-43 24Zm31-68c20 2 27-8 27-23-18 3-23 12-27 23Z"/></svg></div><span class="margin-kicker">本册收录</span><p class="reading-count">${bookDishes().length}<small>道好味</small></p><p>从熟悉的味道里，<br>找下一餐的灵感。</p></aside>`);
    }
    const calendarTitle = main.querySelector('.calendar-head h2');
    if (calendarTitle) {
      const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
      const records = state.records.filter(record => record.date.startsWith(prefix));
      const meals = state.meals.filter(meal => meal.date.startsWith(prefix));
      const days = new Set([...records.map(record => record.date), ...meals.map(meal => meal.date)]).size;
      const titleWrap = document.createElement('div');
      calendarTitle.before(titleWrap);
      titleWrap.append(calendarTitle);
      titleWrap.insertAdjacentHTML('beforeend', `<p class="month-footnote">${days ? `这个月，已留下 ${days} 天的美味 · ${records.length ? records.length + ' 次品尝' : meals.length + ' 餐记录'}` : '新的一页，等待这个月的好味道。'}</p>`);
    }
    main.querySelectorAll('.setting-card').forEach((card, index) => {
      if (card.querySelector('.about-logo')) { card.classList.add('brand-letter'); return; }
      card.insertAdjacentHTML('afterbegin', `<div class="setting-kicker">${['珍藏有方', '按味归档', '我的味觉档案'][index] || '好好收藏'}<span>${String(index + 1).padStart(2, '0')}</span></div>`);
    });
  }

  const sideNote = document.querySelector('.side-note');
  if (sideNote) sideNote.insertAdjacentHTML('afterbegin', '<div class="note-kicker">烟 火 日 常</div>');
  render = function () { baseRender(); enrichPage(); };
  render();
})();
