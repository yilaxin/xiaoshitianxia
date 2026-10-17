(function(){
 'use strict';
 let exporting=false;const previousRender=render;
 function mount(){
  if(view!=='book')return;const toolbar=document.querySelector('.book-toolbar');if(!toolbar)return;
  let button=toolbar.querySelector('[data-action="exportBookPdf"]');
  if(!button){button=document.createElement('button');button.className='btn outline small';button.dataset.action='exportBookPdf';button.type='button';button.title='保存当前翻阅范围的封面及全部内容';toolbar.insertBefore(button,toolbar.querySelector('[data-action="bookFullscreen"]'));}
  button.disabled=exporting||bookBusy||!bookDishes().length;button.setAttribute('aria-busy',String(exporting));button.innerHTML=icon('download')+(exporting?' 正在生成…':' 导出 PDF');
 }
 render=function(){previousRender();mount();};
 document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-action="exportBookPdf"]');if(!button||button.disabled||view!=='book')return;
  event.preventDefault();event.stopImmediatePropagation();if(exporting)return;
  const scope={kind:FoodBooks.kind,category:bookCategory};exporting=true;mount();
  try{const result=await window.desktop.exportBookPdf(scope);if(!result.canceled)toast('整本菜单已保存为 PDF。');}
  catch(error){toast('PDF 导出未完成：'+error.message);}
  finally{exporting=false;mount();}
 },true);
 mount();
})();
