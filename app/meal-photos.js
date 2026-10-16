(function () {
  'use strict';
  const baseOpenMeal = openMeal;
  const viewer = document.createElement('dialog');
  viewer.id = 'mealPhotoDialog';
  viewer.className = 'meal-photo-viewer';
  viewer.setAttribute('aria-label', '整桌照片');
  document.body.append(viewer);
  let mealId = null;
  let photoIndex = 0;

  openMeal = function (id) {
    baseOpenMeal(id);
    const meal = mealBy(id);
    if (!meal) return;
    const photos = meal.photos || [];
    const cards = document.querySelector('#auxDialog .meal-detail-cards');
    if (photos.length) {
      const section = document.createElement('section');
      section.className = 'meal-table-album';
      section.innerHTML = `<header><h3>这一桌的美好</h3><span>${photos.length} 张整桌照片</span></header><div class="meal-table-grid">${photos.map((photo, index) => `<button type="button" data-action="viewMealPhoto" data-meal-id="${esc(id)}" data-index="${index}" aria-label="放大第 ${index + 1} 张整桌照片"><img src="${img(photo)}" alt="${esc(meal.title || '这一餐')}的整桌照片 ${index + 1}"><span>${icon('image')} 查看大图</span></button>`).join('')}</div>`;
      cards.before(section);
    }
    if (!cards.children.length) cards.insertAdjacentHTML('beforebegin', '<p class="meal-dishes-later">逐道菜品可以慢慢补，先把这顿饭的回忆收好。</p>');
  };

  function showPhoto() {
    const meal = mealBy(mealId);
    const photos = meal?.photos || [];
    if (!photos.length) { viewer.close(); return; }
    photoIndex = Math.max(0, Math.min(photoIndex, photos.length - 1));
    viewer.innerHTML = `<div class="dialog-head"><div><h2>${esc(meal.title || '这一桌的美好')}</h2><p>整桌照片 · ${photoIndex + 1} / ${photos.length}</p></div><button type="button" class="icon-btn" data-action="close" aria-label="关闭整桌照片">${icon('close')}</button></div><div class="meal-photo-large"><img src="${img(photos[photoIndex])}" alt="${esc(meal.title || '这一餐')}的整桌照片 ${photoIndex + 1}"></div><div class="dialog-actions"><button type="button" class="btn outline" data-action="previousMealPhoto" ${photoIndex === 0 ? 'disabled' : ''}>${icon('left')} 上一张</button><button type="button" class="btn outline" data-action="nextMealPhoto" ${photoIndex === photos.length - 1 ? 'disabled' : ''}>下一张 ${icon('right')}</button><button type="button" class="btn primary" data-action="close">返回这一餐</button></div>`;
    if (!viewer.open) viewer.showModal();
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button || button.disabled) return;
    if (button.dataset.action === 'viewMealPhoto') {
      mealId = button.dataset.mealId;
      photoIndex = Number(button.dataset.index);
      showPhoto();
    } else if (button.dataset.action === 'previousMealPhoto') { photoIndex--; showPhoto(); }
    else if (button.dataset.action === 'nextMealPhoto') { photoIndex++; showPhoto(); }
  });
  viewer.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key) || event.target.matches('input,textarea,select')) return;
    event.preventDefault();
    event.stopPropagation();
    photoIndex += event.key === 'ArrowLeft' ? -1 : 1;
    showPhoto();
  });
  viewer.addEventListener('click', event => {
    if (event.target !== viewer) return;
    const box = viewer.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) viewer.close();
  });
})();
