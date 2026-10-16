(function () {
  'use strict';
  const baseManageCategories = manageCategories;
  const baseManageTags = manageTags;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let detachCurrent = null;

  function installSorting(dialog, kind = '分类') {
    const list = dialog.querySelector(kind === '分类' ? '#categoryRows' : '#tagRows');
    const addButton = list.querySelector(kind === '分类' ? '[data-action="newCatRow"]' : '#tagsError');
    const help = document.createElement('p');
    help.id = kind === '分类' ? 'categorySortHelp' : 'tagSortHelp';
    help.className = 'category-sort-help';
    help.textContent = '拖动左侧手柄调整顺序，保存后生效。也可选中手柄，用 ↑ ↓ 调整。';
    list.prepend(help);
    const status = document.createElement('span');
    status.className = 'sort-sr-only';
    status.setAttribute('role', 'status');
    list.append(status);
    const animations = new Map();
    let gesture = null;
    let frame = 0;
    const rows = () => [...list.querySelectorAll('.manage-item')];
    const nameOf = row => row.querySelector('input:not([type=hidden])').value.trim() || `新${kind}`;

    function updateHandles() {
      const entries = rows();
      help.hidden = entries.length === 0;
      entries.forEach((row, index) => {
        row.classList.add('category-sort-row');
        let handle = row.querySelector('.category-sort-handle');
        if (!handle) {
          handle = document.createElement('button');
          handle.type = 'button';
          handle.className = 'category-sort-handle';
          handle.title = '按住拖动，或用 ↑ ↓ 调整顺序';
          handle.setAttribute('aria-describedby', help.id);
          handle.innerHTML = '<svg viewBox="0 0 20 24" aria-hidden="true"><circle cx="7" cy="6" r="1"/><circle cx="13" cy="6" r="1"/><circle cx="7" cy="12" r="1"/><circle cx="13" cy="12" r="1"/><circle cx="7" cy="18" r="1"/><circle cx="13" cy="18" r="1"/></svg>';
          row.prepend(handle);
        }
        handle.setAttribute('aria-label', `调整「${nameOf(row)}」的位置，当前第 ${index + 1} 项，共 ${entries.length} 项`);
      });
    }

    function moveRow(row, before, animate = true) {
      if (row.nextElementSibling === before) return;
      const siblings = rows().filter(item => item !== row);
      const oldPositions = new Map(siblings.map(item => [item, item.getBoundingClientRect().top]));
      animations.forEach(animation => animation.cancel());
      animations.clear();
      list.insertBefore(row, before);
      if (animate && !reducedMotion.matches) {
        for (const item of siblings) {
          const distance = oldPositions.get(item) - item.getBoundingClientRect().top;
          if (Math.abs(distance) < 1) continue;
          const animation = item.animate([
            { transform: `translateY(${distance}px)` }, { transform: 'translateY(0)' }
          ], { duration: 150, easing: 'cubic-bezier(.2,.7,.2,1)' });
          animations.set(item, animation);
          animation.finished.then(() => { if (animations.get(item) === animation) animations.delete(item); }, () => {});
        }
      }
      updateHandles();
    }

    function positionRow() {
      if (!gesture?.dragging) return;
      const { row, handle, pointerId } = gesture;
      // Use layout coordinates for hit testing so easing siblings cannot cause oscillation.
      const before = rows().filter(item => item !== row).find(item => {
        const box = item.getBoundingClientRect();
        const transform = getComputedStyle(item).transform;
        const offset = transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m42;
        return gesture.y < box.top - offset + box.height / 2;
      }) || addButton;
      moveRow(row, before);
      row.style.transform = '';
      const box = row.getBoundingClientRect();
      row.style.transform = `translateY(${gesture.y - gesture.grabOffset - box.top}px)`;
      try { if (!handle.hasPointerCapture(pointerId)) handle.setPointerCapture(pointerId); } catch { /* Pointer may already be released. */ }
      handle.focus({ preventScroll: true });
    }

    function autoScroll() {
      if (!gesture?.dragging) return;
      const bounds = dialog.getBoundingClientRect();
      const edge = 42;
      const speed = gesture.y < bounds.top + edge ? -Math.min(16, (bounds.top + edge - gesture.y) / 3)
        : gesture.y > bounds.bottom - edge ? Math.min(16, (gesture.y - bounds.bottom + edge) / 3) : 0;
      if (speed) { dialog.scrollTop += speed; positionRow(); }
      frame = requestAnimationFrame(autoScroll);
    }

    function finishGesture(restore = false) {
      if (!gesture) return;
      const previous = gesture;
      gesture = null;
      cancelAnimationFrame(frame);
      previous.row.classList.remove('category-sort-dragging');
      previous.row.style.transform = '';
      dialog.classList.remove('category-sorting');
      if (restore && previous.dragging) {
        animations.forEach(animation => animation.cancel()); animations.clear();
        previous.originalOrder.forEach(row => { if (row.isConnected) list.insertBefore(row, addButton); });
      }
      try { previous.handle.releasePointerCapture(previous.pointerId); } catch { /* No capture remains. */ }
      updateHandles();
      if (previous.dragging) status.textContent = restore ? '已取消本次拖动。'
        : `${nameOf(previous.row)}已移动到第 ${rows().indexOf(previous.row) + 1} 位，保存${kind}后生效。`;
    }

    function pointerDown(event) {
      const handle = event.target.closest('.category-sort-handle');
      if (!handle || event.button !== 0 || gesture) return;
      event.preventDefault();
      const row = handle.closest('.manage-item');
      handle.focus({ preventScroll: true });
      gesture = { row, handle, pointerId: event.pointerId, startY: event.clientY, y: event.clientY,
        grabOffset: event.clientY - row.getBoundingClientRect().top, originalOrder: rows(), dragging: false };
      handle.setPointerCapture(event.pointerId);
    }

    function pointerMove(event) {
      if (!gesture || event.pointerId !== gesture.pointerId) return;
      event.preventDefault();
      gesture.y = event.clientY;
      if (!gesture.dragging && Math.abs(gesture.y - gesture.startY) < 4) return;
      if (!gesture.dragging) {
        gesture.dragging = true;
        gesture.row.classList.add('category-sort-dragging');
        dialog.classList.add('category-sorting');
        frame = requestAnimationFrame(autoScroll);
      }
      positionRow();
    }

    function pointerUp(event) { if (gesture?.pointerId === event.pointerId) finishGesture(false); }
    function pointerCancel(event) { if (gesture?.pointerId === event.pointerId) finishGesture(true); }
    function abort() { finishGesture(true); }
    function cancelDialog(event) { if (gesture) { event.preventDefault(); finishGesture(true); } }
    function keyDown(event) {
      if (gesture && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); finishGesture(true); return; }
      const handle = event.target.closest('.category-sort-handle');
      if (!handle || !['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      if (gesture) return;
      const row = handle.closest('.manage-item');
      const entries = rows();
      const index = entries.indexOf(row);
      const target = event.key === 'Home' ? 0 : event.key === 'End' ? entries.length - 1
        : Math.max(0, Math.min(entries.length - 1, index + (event.key === 'ArrowUp' ? -1 : 1)));
      if (index === target) return;
      const others = entries.filter(item => item !== row);
      moveRow(row, others[target] || addButton);
      handle.focus({ preventScroll: true });
      row.scrollIntoView({ block: 'nearest' });
      status.textContent = `${nameOf(row)}已移动到第 ${target + 1} 位，保存${kind}后生效。`;
    }

    const observer = new MutationObserver(updateHandles);
    updateHandles();
    observer.observe(list, { childList: true });
    list.addEventListener('input', updateHandles);
    list.addEventListener('pointerdown', pointerDown);
    document.addEventListener('keydown', keyDown, true);
    dialog.addEventListener('cancel', cancelDialog);
    document.addEventListener('pointermove', pointerMove, { passive: false });
    document.addEventListener('pointerup', pointerUp);
    document.addEventListener('pointercancel', pointerCancel);
    window.addEventListener('blur', abort);
    window.addEventListener('resize', abort);
    function cleanup() {
      finishGesture(true);
      observer.disconnect();
      animations.forEach(animation => animation.cancel()); animations.clear();
      list.removeEventListener('input', updateHandles);
      list.removeEventListener('pointerdown', pointerDown);
      document.removeEventListener('keydown', keyDown, true);
      dialog.removeEventListener('cancel', cancelDialog);
      document.removeEventListener('pointermove', pointerMove);
      document.removeEventListener('pointerup', pointerUp);
      document.removeEventListener('pointercancel', pointerCancel);
      window.removeEventListener('blur', abort);
      window.removeEventListener('resize', abort);
      dialog.removeEventListener('close', onClose);
    }
    // A queued close event may arrive after this shared dialog has reopened.
    function onClose() { if (!dialog.open) cleanup(); }
    dialog.addEventListener('close', onClose);
    return cleanup;
  }

  manageCategories = function () {
    detachCurrent?.();
    baseManageCategories();
    detachCurrent = installSorting(document.getElementById('auxDialog'));
  };
  manageTags = function () {
    detachCurrent?.();
    baseManageTags();
    detachCurrent = installSorting(document.getElementById('auxDialog'), '标签');
  };
})();
