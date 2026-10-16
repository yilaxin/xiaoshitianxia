(function () {
  'use strict';
  const baseUploadHtml = photoUploadHtml;
  const queues = new WeakMap();
  let lastTarget = null;

  photoUploadHtml = function (id, ...args) {
    let html = baseUploadHtml(id, ...args).replace('点击选择或拖入', '点击选择、拖入或 Ctrl+V 粘贴');
    if (id === 'mealPhotos') html = html.replace('选择美食照片（选填）','选择整桌照片（选填）').replace('添加美食照片（选填）','添加整桌照片（选填）').replace('可以先填写其他信息，保存后随时编辑补图。','拍下全桌好菜或饭局合照，单独保存在这一餐中。');
    return html +
      `<div class="photo-paste-actions"><button type="button" class="btn outline small" data-action="pastePhoto" data-input="${esc(id)}">${icon('image')} 粘贴图片</button><span class="photo-paste-status" id="paste-status-${esc(id)}" role="status">复制图片或截图后，可直接按 Ctrl+V</span></div>`;
  };

  function valid(draft, preview) {
    return formDraft === draft && preview?.isConnected && document.getElementById('formDialog').open;
  }
  function report(message, error = false, inputId = '') {
    const formError = document.getElementById('formError');
    if (error && formError) formError.textContent = message;
    const status = document.getElementById('paste-status-' + inputId);
    if (status) status.textContent = message;
  }
  function busy(draft, pending) {
    if (formDraft !== draft) return;
    const form = document.getElementById('recordForm');
    if (form) {
      form.dataset.photosPending = String(pending);
      form.querySelector('[type="submit"]').disabled = pending > 0;
    }
  }

  // File selection, drop and paste all use the same bounded, ordered import queue.
  // Captured draft/preview identity prevents a late decode from entering another form.
  processPhotos = function (inputId, files) {
    const list = [...files];
    const draft = formDraft;
    const preview = document.getElementById('preview-' + inputId);
    if (!list.length || !valid(draft, preview)) return Promise.resolve(false);
    let queue = queues.get(draft);
    if (!queue) { queue = { tail: Promise.resolve(), pending: 0 }; queues.set(draft, queue); }
    queue.pending++;
    busy(draft, queue.pending);
    const task = queue.tail.then(async () => {
      if (!valid(draft, preview)) return false;
      try {
        report('正在处理照片…', false, inputId);
        const coverOnly = inputId === 'dishPhotos' && !!draft.editId;
        if (coverOnly && list.length > 1) throw Error('封面请选择一张照片；更多照片可以添加到品尝记录。');
        const before = inputId === 'dishPhotos' ? draft.photos : inputId === 'mealPhotos' ? draft.mealPhotos : draft.newMealDishes.find(dish => dish.id === inputId)?.photos;
        if (!before) return false;
        if (!coverOnly && before.length + list.length > 12) throw Error(inputId === 'mealPhotos' ? '每顿饭最多添加 12 张整桌照片。' : '每道菜的本次品尝最多添加 12 张照片。');
        const photos = await filesToPhotos(list);
        if (!valid(draft, preview)) return false;
        const target = inputId === 'dishPhotos' ? draft : inputId === 'mealPhotos' ? { photos: draft.mealPhotos } : draft.newMealDishes.find(dish => dish.id === inputId);
        if (!target) return false;
        if (!coverOnly && target.photos.length + photos.length > 12) throw Error(inputId === 'mealPhotos' ? '每顿饭最多添加 12 张整桌照片。' : '每道菜的本次品尝最多添加 12 张照片。');
        if (coverOnly) {
          target.photos = [];
          draft.cover = null;
          document.querySelectorAll('[data-action="coverPick"]').forEach(element => element.classList.remove('selected'));
        }
        target.photos.push(...photos);
        preview.innerHTML = target.photos.map((photo, index) => `<span style="position:relative;display:inline-block"><img src="${img(photo)}" alt="已选照片 ${index + 1}"><button type="button" data-action="removeUpload" data-input="${esc(inputId)}" data-index="${index}" style="position:absolute;right:2px;top:2px;background:#fffdf4dd;border-radius:50%;height:20px;width:20px;padding:0;font-size:14px" aria-label="移除照片${index + 1}">×</button></span>`).join('');
        document.getElementById('formError').textContent = '';
        report(coverOnly ? '封面已更新，保存后生效' : `已添加 ${photos.length} 张照片，当前共 ${target.photos.length} 张`, false, inputId);
        return true;
      } catch (error) {
        if (valid(draft, preview)) report(error.message, true, inputId);
        return false;
      }
    }).finally(() => {
      queue.pending--;
      if (valid(draft, preview)) busy(draft, queue.pending);
    });
    queue.tail = task;
    return task;
  };

  function zoneFrom(element) {
    if (!(element instanceof Element)) return null;
    return element.closest('[data-upload-zone]') || element.closest('.new-meal-item,.meal-photo-block')?.querySelector('[data-upload-zone]') ||
      (element.matches('#mealDate,#mealType,#mealTitle,#mealPlace,#mealMaker,#mealNote') ? document.getElementById('drop-mealPhotos') : null) ||
      (element.closest('[data-action="pastePhoto"]') ? document.getElementById('drop-' + element.closest('[data-action="pastePhoto"]').dataset.input) : null);
  }
  function targetFor(element) {
    const zone = zoneFrom(element);
    if (zone) return zone.dataset.uploadZone;
    if (lastTarget?.draft === formDraft && lastTarget.zone.isConnected) return lastTarget.zone.dataset.uploadZone;
    if (formMode === 'meal' && document.getElementById('drop-mealPhotos')) return 'mealPhotos';
    const zones = document.querySelectorAll('#formDialog [data-upload-zone]');
    return zones.length === 1 ? zones[0].dataset.uploadZone : null;
  }
  const formDialog = document.getElementById('formDialog');
  formDialog.addEventListener('close', () => { if (!formDialog.open) { lastTarget = null; formDraft = null; } });
  for (const type of ['focusin', 'pointerdown']) formDialog.addEventListener(type, event => {
    const zone = zoneFrom(event.target);
    if (zone) lastTarget = { draft: formDraft, zone };
  });
  formDialog.addEventListener('paste', event => {
    if (!formDialog.open) return;
    const files = [...(event.clipboardData?.items || [])].filter(item => item.kind === 'file' && item.type.startsWith('image/')).map(item => item.getAsFile()).filter(Boolean);
    if (!files.length) return; // Ordinary text paste keeps its native behavior.
    event.preventDefault();
    const inputId = targetFor(event.target);
    if (!inputId) { report('请先点击要添加照片的新菜区域，再按 Ctrl+V；也可以点击对应的「粘贴图片」。', true); return; }
    void processPhotos(inputId, files);
  });
  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-action="pastePhoto"]');
    if (!button || !formDialog.open) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const inputId = button.dataset.input;
    lastTarget = { draft: formDraft, zone: document.getElementById('drop-' + inputId) };
    const draft = formDraft;
    const preview = document.getElementById('preview-' + inputId);
    let queue = queues.get(draft);
    if (!queue) { queue = { tail: Promise.resolve(), pending: 0 }; queues.set(draft, queue); }
    queue.pending++;
    busy(draft, queue.pending);
    try {
      const data = await window.desktop.readClipboardImage();
      if (!valid(draft, preview)) return;
      if (!data) { report('剪贴板里没有图片，请先复制图片或截图，再试一次。', true, inputId); return; }
      const bytes = Uint8Array.from(atob(data.slice(data.indexOf(',') + 1)), character => character.charCodeAt(0));
      await processPhotos(inputId, [new File([bytes], '粘贴的图片.png', { type: 'image/png' })]);
    } catch (error) { if (valid(draft, preview)) report('粘贴未完成：' + error.message, true, inputId); }
    finally { queue.pending--; if (valid(draft, preview)) busy(draft, queue.pending); }
  }, true);
  formDialog.addEventListener('submit', event => {
    if (Number(event.target.dataset.photosPending) > 0) {
      event.preventDefault();
      event.stopImmediatePropagation();
      report('照片正在处理，请稍等片刻再保存。', true);
    }
  }, true);
})();
