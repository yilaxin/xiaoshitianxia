(function(){
 'use strict';
 const data=FoodCalendarData,baseCalendar=renderCalendar,basePanel=renderDayPanel,baseRender=render,baseValid=validBackup;
 const pen='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m15 4 5 5M4 20l5-1L20 8a2 2 0 0 0-5-5L4 14Z" stroke="currentColor" stroke-width="1.5"/></svg>';
 const noteFor=date=>state.dayNotes?.[date]||null;
 const lunarHeading=date=>{const info=data.dayInfo(date);return info?[info.lunarFull,info.festival,info.status==='rest'?info.holiday+'假期':info.status==='work'?'调休补班':''].filter(Boolean).join(' · '):'';};
 renderDayPanel=function(){
  const template=document.createElement('template');template.innerHTML=basePanel();const note=noteFor(selectedDate),info=data.dayInfo(selectedDate);
  const header=template.content.querySelector('header');header.querySelector('h2').textContent=`${+selectedDate.slice(5,7)} 月 ${+selectedDate.slice(8)} 日的日常`;
  const holiday=`<section class="day-holiday-info"><strong>${info.festival?esc(info.festival):esc(info.lunarFull)}</strong><p>${esc([info.festival?info.lunarFull:'',info.status==='rest'?info.holiday+'假期 · 休息日':info.status==='work'?'调休补班日':'',!info.hasSchedule?'本年暂未收录官方调休数据':''].filter(Boolean).join(' · ')||'寻常日子，也值得留下几句话。')}</p></section>`;
  const journal=`<section class="day-journal"><header><h3>这一天的随记</h3><button class="btn outline small" data-action="calendarWriteNote" data-date="${selectedDate}">${pen} ${note?'编辑':'写几句'}</button></header>${note?`${note.title?`<h4>${esc(note.title)}</h4>`:''}<div class="day-journal-body">${esc(note.body)}</div><footer class="day-journal-footer"><span>独立记录 · 与当天美食一起收藏</span><button class="btn text small" data-action="calendarReadNote" data-date="${selectedDate}">展开阅读</button></footer>`:'<p class="day-journal-empty">今天有什么想留下的？<br>一件小事、一点感想，都可以记在这里。</p>'}</section><h3 class="day-meals-heading">当天的美食</h3>`;
  header.insertAdjacentHTML('afterend',holiday+journal);
  if(note){const empty=template.content.querySelector('.calendar-empty');if(empty)empty.innerHTML='<p style="font-size:14px;letter-spacing:0">这一天还没有美食记录，<br>也可以先把心情留在随记里。</p>';}
  return template.innerHTML;
 };
 renderCalendar=function(){
  const template=document.createElement('template');template.innerHTML=baseCalendar();
  template.content.querySelectorAll('[data-action="selectDay"]').forEach(cell=>{
   const date=cell.dataset.date,info=data.dayInfo(date),note=noteFor(date);if(!info)return;
   const number=cell.querySelector('.day-num');number.insertAdjacentHTML('afterend',`<span class="day-lunar ${info.festival?'festival':''}">${esc(info.festival||info.lunar)}</span>`);
   if(info.status){cell.classList.toggle('has-holiday',info.status==='rest');cell.insertAdjacentHTML('beforeend',`<span class="day-work-badge ${info.status}">${info.status==='rest'?'休':'班'}</span>`);}
   if(note){cell.insertAdjacentHTML('beforeend',`<span class="day-note-mark">${pen} 随记</span>${!cell.querySelector('img,.no-photo-mark,.empty-meal-mark')?`<span class="day-note-title">${esc(note.title||note.body)}</span>`:''}`);cell.classList.add('has-day-note');}
   cell.setAttribute('aria-label',cell.getAttribute('aria-label')+'，'+[info.lunarFull,info.festival,info.status==='rest'?info.holiday+'放假':info.status==='work'?'调休补班':'',note?'有日常随记':''].filter(Boolean).join('，'));
  });
  template.content.querySelector('.calendar-controls').insertAdjacentHTML('afterbegin','<button class="holiday-help" data-action="calendarHolidayInfo">假期说明</button>');
  const legend=template.content.querySelector('.calendar-legend');legend.innerHTML=`<span class="legend-rest">休 · 放假</span><span class="legend-work">班 · 调休补班</span><span>美食缩略图 · 用餐记录</span><span>✎ 随记 · 自己写下的日常</span>`;
  legend.insertAdjacentHTML('afterend',`<p class="holiday-coverage">${data.schedules[year]?`${year} 年放假调休依据国务院办公厅通知 · 中国大陆`:`${year} 年暂未收录官方调休安排；节日名称和农历日期照常显示。`}</p>`);
  return template.innerHTML;
 };
 render=function(){baseRender();if(view!=='calendar')return;
  const prefix=`${year}-${String(month+1).padStart(2,'0')}-`,notes=Object.keys(state.dayNotes||{}).filter(d=>d.startsWith(prefix));
  const footnote=document.querySelector('.month-footnote');if(footnote&&notes.length){const records=state.records.filter(r=>r.date.startsWith(prefix)),meals=state.meals.filter(m=>m.date.startsWith(prefix));const days=new Set([...notes,...records.map(r=>r.date),...meals.map(m=>m.date)]).size;footnote.textContent=`这个月，已留下 ${days} 天的记录 · ${records.length?records.length+' 次品尝':meals.length+' 餐记录'} · ${notes.length} 篇随记`;}
 };
 validBackup=function(obj){return baseValid(obj)&&data.validateNotes(obj.data);};
 const editor=document.createElement('dialog');editor.id='dayNoteDialog';editor.className='day-note-dialog';editor.setAttribute('aria-label','日常随记');document.body.append(editor);
 const viewer=document.createElement('dialog');viewer.id='dayNoteReadDialog';viewer.className='note-read-dialog';viewer.setAttribute('aria-label','阅读日常随记');document.body.append(viewer);
 const confirm=document.createElement('dialog');confirm.id='dayNoteConfirmDialog';confirm.className='confirm-dialog';document.body.append(confirm);
 let editingDate=null,original={title:'',body:''},confirmation=null,undo=null,undoUntil=0,undoTimer=null;
 const currentValues=()=>({title:editor.querySelector('[name=noteTitle]')?.value||'',body:editor.querySelector('[name=noteBody]')?.value||''});
 function isDirty(){const v=currentValues();return editor.open&&(v.title!==original.title||v.body!==original.body);}
 function askDiscard(){if(!isDirty()){editor.close();return;}confirmation='discard';confirm.innerHTML=`<div class="dialog-head"><h2>这几句话还没有保存</h2></div><div class="dialog-body"><p>可以继续写，或者放弃这次修改。已保存的随记会保留。</p></div><div class="dialog-actions"><button class="btn outline" data-action="calendarCancelConfirm">继续编辑</button><button class="btn primary" data-action="calendarConfirmNote">放弃修改</button></div>`;confirm.showModal();}
 function openNote(date){if(!data.dateOk(date))return;const note=noteFor(date);editingDate=date;original={title:note?.title||'',body:note?.body||''};
  editor.innerHTML=`<div class="dialog-head"><div><h2>${note?'编辑':'写下'}这一天</h2><p>${esc(dateLong(date))} · ${esc(lunarHeading(date))}</p></div><button class="icon-btn" type="button" data-action="calendarCloseNote" aria-label="关闭随记">${icon('close')}</button></div><form id="dayNoteForm"><div class="dialog-body"><div class="field"><label for="dayNoteTitle">给这一天起个标题（选填）</label><input id="dayNoteTitle" name="noteTitle" maxlength="80" value="${esc(original.title)}" placeholder="比如：平凡日子里的小确幸"></div><div class="field"><label for="dayNoteBody">想留下的话<i>*</i></label><textarea id="dayNoteBody" name="noteBody" required maxlength="20000" placeholder="今天发生了什么？心情如何？有什么想记住的事…">${esc(original.body)}</textarea><p class="note-save-hint">不需要先添加美食，也可以单独记录。点击保存后写入本机资料库。</p></div><p id="dayNoteError" class="error" role="alert"></p></div><div class="dialog-actions">${note?'<button type="button" class="btn danger-outline small" data-action="calendarDeleteNote">删除随记</button>':'<small>这份日常也会随完整备份一起保存。</small>'}<button type="button" class="btn outline" data-action="calendarCloseNote">取消</button><button type="submit" class="btn primary">保存随记</button></div></form>`;
  editor.querySelector('form').onsubmit=event=>{event.preventDefault();const values=currentValues();if(!values.body.trim()){editor.querySelector('#dayNoteError').textContent='写几句话，再把这一天收好吧。';return;}
   const next=structuredClone(state);next.dayNotes=next.dayNotes||{};next.dayNotes[editingDate]={title:values.title.trim(),body:values.body,updated:new Date().toISOString()};if(!commit(next))return;original=values;editor.close();selectedDate=editingDate;year=+editingDate.slice(0,4);month=+editingDate.slice(5,7)-1;render();toast('这一天的随记，已经好好收下。');
  };
  editor.showModal();editor.querySelector('#dayNoteBody').focus();
 }
 function readNote(date){const note=noteFor(date);if(!note)return;viewer.innerHTML=`<div class="dialog-head"><div><h2>${esc(note.title||'这一天的随记')}</h2><p>${esc(dateLong(date))} · ${esc(lunarHeading(date))}</p></div><button class="icon-btn" data-action="close" aria-label="关闭随记阅读">${icon('close')}</button></div><div class="note-read-body">${esc(note.body)}</div><div class="dialog-actions"><button class="btn outline" data-action="close">返回日历</button><button class="btn primary" data-action="calendarEditReadNote" data-date="${date}">编辑随记</button></div>`;viewer.showModal();}
 function askDelete(){confirmation='delete';confirm.innerHTML=`<div class="dialog-head"><h2>删除这一天的随记？</h2></div><div class="dialog-body"><p>${esc(dateLong(editingDate))} 的文字随记会移除，当天的美食和用餐记录会保留。</p><p class="status-note">删除前会保存完整备份，删除后 30 秒内可撤销。</p><p id="dayNoteDeleteError" class="error"></p></div><div class="dialog-actions"><button class="btn outline" data-action="calendarCancelConfirm">先保留</button><button class="btn primary" data-action="calendarConfirmNote">确认删除</button></div>`;confirm.showModal();}
 function confirmAction(){if(confirmation==='discard'){confirm.close();editor.close();return;}
  if(confirmation!=='delete'||!noteFor(editingDate))return;try{window.desktop.snapshotBeforeDelete();const saved=structuredClone(noteFor(editingDate)),next=structuredClone(state);delete next.dayNotes[editingDate];if(!commit(next))return;clearTimeout(undoTimer);undo={date:editingDate,note:saved};undoUntil=Date.now()+30000;undoTimer=setTimeout(()=>{undo=null;},30000);confirm.close();editor.close();render();toast('这一天的随记已删除，美食记录仍然保留。');const btn=document.createElement('button');btn.className='undo-button';btn.dataset.action='calendarUndoNote';btn.textContent='撤销';document.getElementById('toast').append(btn);clearTimeout(toastTimer);toastTimer=setTimeout(()=>document.getElementById('toast').classList.remove('show'),30000);}catch(e){confirm.querySelector('#dayNoteDeleteError').textContent=e.message;}
 }
 function holidayHelp(){const schedule=data.schedules[year],dialog=document.getElementById('auxDialog');dialog.style.width='610px';dialog.innerHTML=`<div class="dialog-head"><div><h2>${year} 年节假日说明</h2><p>节日当天、放假安排与调休补班分别标注。</p></div><button class="icon-btn" data-action="close" aria-label="关闭假期说明">${icon('close')}</button></div><div class="dialog-body">${schedule?`<div class="holiday-list">${schedule.breaks.map(([name,start,end])=>`<article><strong>${name}</strong><span>${year}-${start} 至 ${year}-${end}</span></article>`).join('')}</div><p class="status-note">调休补班：${schedule.work.map(d=>year+'-'+d).join('、')}。</p><p class="holiday-source">来源：国务院办公厅《${year} 年部分节假日安排的通知》<br>${schedule.document}<br>${esc(schedule.source)}<br>本版核对日期：2026-10-16</p>`:`<p class="notice">目前内置 2025、2026 年的官方放假调休数据。${year} 年仍显示农历与常见节日，暂不标注「休／班」。</p>`}<p class="status-note" style="margin-top:15px">日历中的节日名称不等同于全体公民放假安排。「休」表示年度通知中的放假或连休日期，「班」表示调休补班日期。假期数据内置在本机，可离线查看。</p></div>`;dialog.showModal();}
 const handlers={
  calendarWriteNote:b=>openNote(b.dataset.date),calendarCloseNote:askDiscard,calendarDeleteNote:askDelete,calendarConfirmNote:confirmAction,calendarCancelConfirm:()=>confirm.close(),calendarReadNote:b=>readNote(b.dataset.date),calendarEditReadNote:b=>{viewer.close();openNote(b.dataset.date);},calendarHolidayInfo:holidayHelp,
  calendarUndoNote:()=>{if(!undo||Date.now()>undoUntil){undo=null;toast('撤销时间已过，可以从删除前的备份恢复。');return;}if(noteFor(undo.date)){toast('这一天已经有新的随记，请从删除前备份找回旧内容。');return;}const next=structuredClone(state);next.dayNotes=next.dayNotes||{};next.dayNotes[undo.date]=undo.note;if(commit(next)){undo=null;render();toast('随记已找回。');}}
 };
 document.addEventListener('click',event=>{const button=event.target.closest('[data-action]');if(!button||button.disabled||!handlers[button.dataset.action])return;event.preventDefault();event.stopImmediatePropagation();handlers[button.dataset.action](button);},true);
 const previousRestore=restoreState;restoreState=function(next){const ok=previousRestore(next);if(ok){undo=null;clearTimeout(undoTimer);}return ok;};
 editor.addEventListener('cancel',event=>{if(isDirty()){event.preventDefault();askDiscard();}});
 for(const dialog of [editor,viewer,confirm])dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom){if(dialog===editor)askDiscard();else dialog.close();}});
 globalThis.FoodJournal={open:openNote,read:readNote};render();
})();
