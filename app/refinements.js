(function () {
  'use strict';
  const actions = globalThis.FoodDataActions;
  let undoPayload = null;
  let undoTimer = null;
  let pendingDeletion = null;
  let openingAnimation = null;
  const baseToast = toast;
  const baseOpenDish = openDish;
  const baseOpenMeal = openMeal;
  const baseSetView = setView;
  const baseFlipBook = flipBook;
  const baseCards = renderCards;
  const baseCalendar = renderCalendar;
  const baseDayPanel = renderDayPanel;

  const deleteDialog = document.createElement('dialog');
  deleteDialog.id = 'deleteDialog';
  deleteDialog.className = 'confirm-dialog';
  deleteDialog.setAttribute('aria-label', '删除确认');
  document.body.append(deleteDialog);
  deleteDialog.addEventListener('click', event => {
    if (event.target !== deleteDialog) return;
    const box = deleteDialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) deleteDialog.close();
  });
  deleteDialog.addEventListener('close', () => { pendingDeletion = null; });

  toast = function (message, options = {}) {
    baseToast(message);
    const element = document.getElementById('toast');
    element.classList.toggle('with-action', !!options.undo);
    if (!options.undo) return;
    clearTimeout(toastTimer);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'undo-button';
    button.dataset.action = 'undoDelete';
    button.textContent = '撤销';
    element.append(button);
    toastTimer = setTimeout(() => element.classList.remove('show'), 30000);
  };

  function addDeleteButton(parent, label, kind, id, small = false) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = small ? 'danger-action' : 'btn danger-outline small';
    button.dataset.action = 'requestDelete';
    button.dataset.kind = kind;
    button.dataset.id = id;
    button.innerHTML = (small ? '' : icon('trash') + ' ') + label;
    parent.append(button);
  }

  openDish = function (id) {
    baseOpenDish(id);
    if (!dishBy(id)) return;
    const dialog = document.getElementById('detailDialog');
    const summary = dialog.querySelector('.detail-summary');
    const area = document.createElement('div');
    area.className = 'detail-destructive';
    addDeleteButton(area, '删除这道菜', 'dish', id);
    summary.append(area);
    dialog.querySelectorAll('[data-action="editRecord"]').forEach(edit => {
      const row = document.createElement('div');
      row.className = 'history-actions';
      edit.before(row);
      row.append(edit);
      addDeleteButton(row, '删除这次记录', 'record', edit.dataset.id, true);
    });
  };

  openMeal = function (id) {
    baseOpenMeal(id);
    if (!mealBy(id)) return;
    const footer = document.querySelector('#auxDialog .dialog-actions');
    const group = document.createElement('div');
    group.style.marginRight = 'auto';
    addDeleteButton(group, '删除这顿饭', 'meal', id);
    footer.prepend(group);
  };

  function requestDeletion(kind, id) {
    const dish = kind === 'dish' ? dishBy(id) : null;
    const meal = kind === 'meal' ? mealBy(id) : null;
    const record = kind === 'record' ? state.records.find(item => item.id === id) : null;
    if (!(dish || meal || record)) { toast('这条内容已经不存在。'); return; }
    let title, text, effects;
    if (dish) {
      const records = state.records.filter(item => item.dishId === id);
      title = '删除这道菜？';
      text = `即将删除「${dish.name}」及它的 ${records.length} 次品尝记录。`;
      effects = ['它会从菜单、书本和日历中移除。', '相关用餐的标题、地点和整餐备注会保留，其他菜品不受影响。'];
    } else if (meal) {
      const count = state.records.filter(item => item.mealId === id).length;
      title = '删除这顿饭？';
      text = `即将删除「${meal.title || meal.type}」和这一餐中的 ${count} 条品尝记录。`;
      effects = ['菜单里的菜品收藏会保留。', '这些菜在其他日期的品尝记录不受影响。'];
    } else {
      title = '删除这次品尝记录？';
      text = `即将删除「${dishBy(record.dishId)?.name || '这道菜'}」在 ${dateLong(record.date)} 的这次记录。`;
      effects = ['这道菜的收藏和其他品尝记录会保留。', '如果它属于一顿饭，整餐的备注和其他菜品也会保留。'];
    }
    pendingDeletion = { kind, id };
    deleteDialog.innerHTML = `<div class="dialog-head"><h2>${title}</h2><button class="icon-btn" data-action="cancelDelete" aria-label="取消删除">${icon('close')}</button></div><div class="dialog-body"><p class="confirm-description">${esc(text)}</p><div class="delete-impact">${effects.map(effect => `<p>${esc(effect)}</p>`).join('')}</div><p class="status-note" style="margin-top:16px">删除后可立即撤销；本机版还会在删除前保存一份完整资料。</p><p id="deleteError" class="error" role="alert"></p></div><div class="dialog-actions"><small>确认后，所有浏览页面会同步更新。</small><button class="btn outline" data-action="cancelDelete">先保留</button><button class="btn primary" data-action="confirmDelete">${icon('trash')} 确认删除</button></div>`;
    deleteDialog.showModal();
    deleteDialog.querySelector('[data-action="cancelDelete"]').focus();
  }

  function confirmDeletion() {
    if (!pendingDeletion) return;
    const { kind, id } = pendingDeletion;
    try {
      const operation = { dish: actions.removeDish, meal: actions.removeMeal, record: actions.removeRecord }[kind];
      const result = operation(state, id);
      if (window.desktop) window.desktop.snapshotBeforeDelete();
      if (!commit(result.state)) return;
      undoPayload = result.undo;
      clearTimeout(undoTimer);
      undoTimer = setTimeout(() => { undoPayload = null; }, 30000);
      deleteDialog.close();
      document.getElementById('auxDialog').close();
      if (kind === 'dish') {
        document.getElementById('detailDialog').close();
        detailId = null;
      }
      render();
      if (kind !== 'dish' && detailId && document.getElementById('detailDialog').open && dishBy(detailId)) openDish(detailId);
      toast(kind === 'dish' ? '这道菜和对应的品尝记录已删除。' : kind === 'meal' ? '这顿饭已删除，菜品收藏仍然保留。' : '这次品尝记录已删除。', { undo: true });
    } catch (error) {
      document.getElementById('deleteError').textContent = '删除未完成：' + error.message;
    }
  }

  function undoDeletion() {
    if (!undoPayload) { toast('撤销时间已过，可以从删除前的备份恢复。'); return; }
    const next = actions.restoreRemoved(state, undoPayload);
    if (!commit(next)) return;
    undoPayload = null;
    clearTimeout(undoTimer);
    render();
    if (detailId && document.getElementById('detailDialog').open && dishBy(detailId)) openDish(detailId);
    toast('已撤销删除，内容已经找回。');
  }

  if (typeof restoreState === 'function') {
    const baseRestoreState = restoreState;
    restoreState = function (next) {
      const success = baseRestoreState(next);
      if (success) { undoPayload = null; clearTimeout(undoTimer); }
      return success;
    };
  }

  renderCards = function (dishes) {
    const template = document.createElement('template');
    template.innerHTML = baseCards(dishes);
    for (const dish of dishes) {
      if (allRecords(dish.id).length) continue;
      const entry = [...template.content.querySelectorAll('.food-card')].find(card => card.querySelector('[data-action="openDish"]')?.dataset.id === dish.id);
      const date = entry?.querySelector('.card-bottom span');
      if (date) date.innerHTML = icon('calendar') + ' 尚无品尝记录';
    }
    return template.innerHTML;
  };

  renderDayPanel = function () {
    const template = document.createElement('template');
    template.innerHTML = baseDayPanel();
    const meals = state.meals.filter(item => item.date === selectedDate).length;
    const records = state.records.filter(item => item.date === selectedDate).length;
    if (meals || records) template.content.querySelector('.day-caption').textContent = `${meals} 餐记录 · ${records} 道美味`;
    return template.innerHTML;
  };

  renderCalendar = function () {
    const template = document.createElement('template');
    template.innerHTML = baseCalendar();
    template.content.querySelectorAll('[data-action="selectDay"]').forEach(day => {
      const meals = state.meals.filter(meal => meal.date === day.dataset.date).length;
      const records = state.records.filter(record => record.date === day.dataset.date).length;
      if (!meals || records || day.querySelector('img')) return;
      day.insertAdjacentHTML('beforeend', `<span class="empty-meal-mark">${icon('bowl')}<span>${meals} 餐</span></span>`);
      day.setAttribute('aria-label', `${dateLong(day.dataset.date)}，${meals}餐，0道菜`);
    });
    return template.innerHTML;
  };

  function coverContents() {
    if(globalThis.FoodBooks)return globalThis.FoodBooks.coverContents();
    return `<div class="cover-border">${logoHtml()}<p>A TASTE OF YOUR LIFE<br>私人美食收藏</p><div class="cover-open-hint">翻开第一页 ${icon('arrow')}</div><div class="cover-bottom">一餐一味 · 一页一念</div></div>`;
  }

  function spreadContents(dish, index) {
    const records = allRecords(dish.id);
    return `<div class="book" id="bookSpread"><div class="book-left"><img class="book-photo" src="${img(dish.cover)}" alt="${esc(dish.name)}"><span class="book-image-label">${esc(dish.tags[0] || '人间烟火')} · ${esc(dish.category || '美味收藏')}</span></div><div class="book-right"><div class="book-section">${esc(dish.category || '美味收藏')} / MY PRIVATE MENU</div><div class="book-num">${String(index + 1).padStart(2, '0')}</div><h2>${esc(dish.name)}</h2><p class="book-intro">${esc(dish.description || '把喜欢的味道，留在这一页。')}</p><div class="book-rule"></div><div class="book-info"><span>最近相遇 &nbsp; ${records.length ? lastDate(dish).replaceAll('-', ' . ') : '尚未记录'}</span><span>已经品尝 &nbsp; ${records.length} 次</span><span>${dish.tags.map(tag => '# ' + esc(tag)).join(' &nbsp; ')}</span></div><button class="btn outline small" data-action="openDish" data-id="${dish.id}">翻看这道菜的回忆 ${icon('arrow')}</button><div class="book-page"><span>笑食天下 · ${dish.favorite ? '心头好味道' : '美味收藏'}</span><span>— ${String(index * 2 + 2).padStart(2, '0')} —</span></div></div></div>`;
  }

  renderBook = function () {
    const list = bookDishes();
    state.bookIndex = Math.max(0, Math.min(state.bookIndex || 0, list.length - 1));
    const empty = `<div class="empty"><h3>这一章，还在等待美味</h3><p>先收藏几道喜欢的菜，再回来翻阅。</p><button class="btn outline" data-action="add">收藏一道菜</button></div>`;
    const content = !list.length ? empty : bookCover ? `<button class="book-cover" data-action="openBookAnimated" aria-label="翻开菜单到第一页">${coverContents()}</button>` : spreadContents(list[state.bookIndex], state.bookIndex);
    return pageHead('翻阅菜单', 'THE BOOK OF YOUR FAVORITE FLAVORS', '把吃过的美好，一页一页，慢慢翻。', '一本属于你的美食之书') + `<div class="book-toolbar"><div style="display:flex;gap:8px"><button class="btn outline small" data-action="bookCatalog" ${bookBusy ? 'disabled' : ''}>${icon('list')} 菜单目录</button><button class="btn outline small" data-action="toggleBookCover" ${bookBusy || !list.length ? 'disabled' : ''}>${bookCover ? '打开书页' : '查看封面'}</button></div><select id="bookCategory" aria-label="翻阅范围" ${bookBusy ? 'disabled' : ''}>${['全部', '特别喜欢', ...state.categories].map(item => `<option ${item === bookCategory ? 'selected' : ''}>${esc(item)}</option>`).join('')}</select></div><section class="book-stage" aria-busy="${bookBusy}">${content}</section><div class="book-nav"><button class="btn outline" data-action="prevBook" ${state.bookIndex === 0 || bookCover || !list.length || bookBusy ? 'disabled' : ''}>${icon('left')} 上一页</button><span class="position">${bookCover ? '封面' : `${list.length ? state.bookIndex + 1 : 0} / ${list.length}`}</span><button class="btn outline" data-action="${bookCover ? 'openBookAnimated' : 'nextBook'}" ${!list.length || bookBusy || (!bookCover && state.bookIndex >= list.length - 1) ? 'disabled' : ''}>${bookCover ? '翻开第一页' : '下一页'} ${icon('right')}</button></div><p class="book-tip">${icon('book')} ${bookCover ? '点击封面，翻开属于你的私人菜单。' : '使用键盘 ← → 翻页，也可以从目录直接找到喜欢的菜。'}</p>` + foot();
  };

  setView = function (next) {
    if (next !== 'book' && openingAnimation) openingAnimation.cancel();
    if (next === 'book' && view !== 'book') bookCover = true;
    baseSetView(next);
  };

  async function openBookAnimated() {
    if (bookBusy || !bookCover || !bookDishes().length) return;
    const originalCover = document.querySelector('.book-cover');
    const originalRect = originalCover?.getBoundingClientRect();
    state.bookIndex = 0;
    bookCover = false;
    if (!originalRect || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { save(); render(); return; }
    bookBusy = true;
    render();
    const stage = document.querySelector('.book-stage');
    const book = document.getElementById('bookSpread');
    const stageRect = stage.getBoundingClientRect();
    const rightRect = book.querySelector('.book-right').getBoundingClientRect();
    const overlay = document.createElement('div');
    overlay.className = 'book-cover-turner';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `<div class="book-front-face">${coverContents()}</div><div class="book-back-face">${logoHtml()}</div>`;
    const coverSpace = document.createElement('div');
    coverSpace.className = 'book-cover-space';
    coverSpace.append(overlay);
    stage.append(coverSpace);
    const first = { left: `${originalRect.left - stageRect.left}px`, top: `${originalRect.top - stageRect.top}px`, width: `${originalRect.width}px`, height: `${originalRect.height}px`, transform: 'rotateY(0deg)' };
    const target = { left: `${rightRect.left - stageRect.left}px`, top: `${rightRect.top - stageRect.top}px`, width: `${rightRect.width}px`, height: `${rightRect.height}px` };
    Object.assign(overlay.style, first);
    // Keep a blank paper block under the cover. The actual photo and text stay
    // hidden until the cover has completed its rotation, then settle in softly.
    const bookRect = book.getBoundingClientRect();
    const paper = document.createElement('div');
    paper.className = 'book-opening-paper';
    paper.setAttribute('aria-hidden', 'true');
    Object.assign(paper.style, { left: `${bookRect.left-stageRect.left}px`, top: `${bookRect.top-stageRect.top}px`, width: `${bookRect.width}px`, height: `${bookRect.height}px` });
    stage.insertBefore(paper, coverSpace);
    book.inert = true;
    const duration = 1300;
    const reveal = book.animate([
      { opacity: 0, offset: 0 }, { opacity: 0, offset: .82, easing: 'ease-out' },
      { opacity: 1, offset: 1 }
    ], { duration, fill: 'both' });
    reveal.id = 'xstx-cover-page-reveal';
    const paperReveal = paper.animate([
      { opacity: 0 }, { opacity: 1, offset: .22 }, { opacity: 1 }
    ], { duration, fill: 'both' });
    paperReveal.id = 'xstx-cover-paper-base';
    openingAnimation = overlay.animate([
      { ...first, offset: 0, easing: 'cubic-bezier(.25,.1,.25,1)' },
      { ...target, transform: 'rotateY(0deg)', offset: .22, easing: 'cubic-bezier(.4,0,.2,1)' },
      { ...target, transform: 'rotateY(-180deg)', offset: .82 },
      { ...target, transform: 'rotateY(-180deg)', offset: 1 }
    ], { duration, fill: 'forwards' });
    openingAnimation.id = 'xstx-cover-opening';
    // Opacity on the rotating parent would flatten its 3D faces in Chromium.
    const faceFades = [...overlay.children].map(face => {
      const animation = face.animate([{ opacity: 1 }, { opacity: 1, offset: .82 }, { opacity: 0 }], { duration, fill: 'both' });
      animation.id = 'xstx-cover-face-fade';
      return animation;
    });
    [reveal, paperReveal, ...faceFades].forEach(animation => animation.finished.catch(() => {}));
    try { await openingAnimation.finished; } catch { /* Navigating away can cancel the effect. */ }
    finally {
      coverSpace.remove();
      reveal.cancel();
      paperReveal.cancel();
      faceFades.forEach(animation => animation.cancel());
      paper.remove();
      book.inert = false;
      openingAnimation = null;
      bookBusy = false;
      if (view === 'book') { if (stage.isConnected) save(); render(); }
    }
  }

  flipBook = function (delta) {
    if (bookCover && delta > 0) { openBookAnimated(); return; }
    baseFlipBook(delta);
  };

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button || button.disabled) return;
    const handlers = {
      requestDelete: () => requestDeletion(button.dataset.kind, button.dataset.id),
      confirmDelete: confirmDeletion,
      cancelDelete: () => deleteDialog.close(),
      undoDelete: undoDeletion,
      openBookAnimated,
      toggleBookCover: () => {
        if (bookBusy) return;
        if (bookCover) openBookAnimated();
        else { bookCover = true; render(); }
      }
    };
    if (!handlers[button.dataset.action]) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    handlers[button.dataset.action]();
  }, true);

  const coverBaseRender = render;
  render = function () {
    // Rebuilding the page invalidates the cover geometry; cancel before replacing it.
    if (openingAnimation) openingAnimation.cancel();
    coverBaseRender();
  };
  window.addEventListener('resize', () => openingAnimation?.cancel());
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', event => {
    if (event.matches) openingAnimation?.cancel();
  });
  render();
})();
