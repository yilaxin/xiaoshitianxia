'use strict';
const {atomic}=require('./storage.cjs');
const titles={flavors:'山珍海味',recipes:'独家食谱',feasts:'欢聚一堂'};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const seeds=new Set(['dumplings','noodles','rice','salad','soup','pizza','pasta','brunch','logo']);
function photoUrl(value){
 if(seeds.has(value))return 'xstx-media://assets/'+value+(value==='logo'?'.png':'.jpg');
 if(/^local:[a-f0-9]{64}\.(jpg|png|webp)$/.test(value||''))return 'xstx-media://photos/'+value.slice(6);
 if(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value||''))return value;
 return '';
}
function selectEntries(state,scope){
 if(!scope||!Object.hasOwn(titles,scope.kind))throw Error('请选择要导出的美食之书。');
 if(scope.kind==='recipes')return [...(state.recipes||[])].sort((a,b)=>b.created.localeCompare(a.created));
 if(scope.kind==='feasts')return [...state.meals].sort((a,b)=>b.date.localeCompare(a.date));
 const category=scope.category||'全部';
 if(!['全部','特别喜欢',...state.categories].includes(category))throw Error('翻阅范围已变化，请重新选择后导出。');
 return state.dishes.filter(d=>category==='全部'||(category==='特别喜欢'?d.favorite:d.category===category));
}
function buildBookHtml(state,scope){
 const entries=selectEntries(state,scope);if(!entries.length)throw Error('这本书还没有内容，先添加记录再导出。');
 const title=titles[scope.kind],range=scope.kind==='flavors'?(scope.category||'全部'):'全部';
 const date=new Date().toLocaleDateString('zh-CN',{timeZone:'Asia/Shanghai'});
 const dishes=new Map(state.dishes.map(d=>[d.id,d])),meals=new Map(state.meals.map(m=>[m.id,m])),recordsByDish=new Map(),recordsByMeal=new Map();
 for(const r of state.records){if(!recordsByDish.has(r.dishId))recordsByDish.set(r.dishId,[]);recordsByDish.get(r.dishId).push(r);if(r.mealId){if(!recordsByMeal.has(r.mealId))recordsByMeal.set(r.mealId,[]);recordsByMeal.get(r.mealId).push(r);}}
 const paragraph=(value,label)=>value?`${label?'<h3>'+esc(label)+'</h3>':''}<p>${esc(value)}</p>`:'';
 const picture=(src,label)=>photoUrl(src)?`<figure><img src="${esc(photoUrl(src))}" alt="${esc(label)}"><figcaption>${esc(label)}</figcaption></figure>`:'';
 const photos=(list,label)=>(list||[]).map((src,i)=>picture(src,label+(list.length>1?' '+(i+1):''))).join('');
 const metadata=values=>'<p class="meta">'+values.filter(Boolean).map(esc).join(' · ')+'</p>';
 const dishMeta=d=>metadata([d.category,d.favorite&&'特别喜欢',...d.tags.map(t=>'#'+t)]);
 const body=entries.map((item,i)=>{
  const name=item.name||item.title||item.type,heading=`<header class="entry-heading"><small>${esc(title)} / ${String(i+1).padStart(2,'0')}</small><h1>${esc(name)}</h1></header>`;
  let content='';
  if(scope.kind==='recipes'){
   content=metadata([item.servings&&'份量：'+item.servings,item.duration&&'用时：'+item.duration])+picture(item.cover,'成品参考')+paragraph(item.description,'这道菜的故事');
   if(item.ingredients.length)content+='<h2>食材与用量</h2><table><thead><tr><th>食材</th><th>用量</th></tr></thead><tbody>'+item.ingredients.map(v=>'<tr><td>'+esc(v.name)+'</td><td>'+esc(v.amount||'按口味调整')+'</td></tr>').join('')+'</tbody></table>';
   if(item.steps.length)content+='<h2>制作步骤</h2>'+item.steps.map((step,j)=>paragraph(step.text,'步骤 '+(j+1))+photos(step.photos,'步骤 '+(j+1)+' 配图')).join('');
   content+=paragraph(item.tips,'心得与小贴士');
   if(item.dishId&&dishes.has(item.dishId))content+=metadata(['关联菜品：'+dishes.get(item.dishId).name]);
  }else if(scope.kind==='feasts'){
   const records=recordsByMeal.get(item.id)||[];
   content=metadata([item.date,item.type,item.place&&'地点：'+item.place,item.maker&&'制作者：'+item.maker])+paragraph(item.note,'这一餐的回忆')+photos(item.photos,'整桌照片');
   if(records.length)content+='<h2>这一桌的菜单</h2><ol>'+records.map(r=>'<li>'+esc(dishes.get(r.dishId)?.name||'美味收藏')+'</li>').join('')+'</ol>';
   for(const record of records){const d=dishes.get(record.dishId);if(!d)continue;content+='<h2>'+esc(d.name)+'</h2>'+dishMeta(d)+paragraph(d.description,'关于这道菜')+paragraph(record.note,'这一口的感受')+photos(record.photos.length?record.photos:[d.cover],'当餐菜品照片'+(record.photos.length?'':'（菜品封面）'));}
  }else{
   const records=[...(recordsByDish.get(item.id)||[])].sort((a,b)=>b.date.localeCompare(a.date));
   content=dishMeta(item)+picture(item.cover,'菜品封面')+paragraph(item.description,'关于这道菜')+metadata(['收录：'+item.created,'品尝过 '+records.length+' 次']);
   if(records.length)content+='<h2>关于它的美味回忆</h2>';
   for(const record of records){const meal=meals.get(record.mealId);content+='<h3>'+esc(record.date)+(meal?' / '+esc(meal.title||meal.type):'')+'</h3>'+metadata([meal?.type,meal?.place&&'地点：'+meal.place,meal?.maker&&'制作者：'+meal.maker])+paragraph(record.note)+photos(record.photos,'这次品尝的照片');}
  }
  return '<article>'+heading+content+'</article>';
 }).join('');
 return {title,count:entries.length,html:`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src xstx-media: data:; style-src 'unsafe-inline'; base-uri 'none'; object-src 'none'; frame-src 'none'"><title>笑食天下 · ${title}</title><style>
 @page{size:A4;margin:16mm 17mm 18mm}*{box-sizing:border-box}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0;color:#342b25;background:#fffdf7;font:16px/1.85 'Microsoft YaHei','Noto Sans CJK SC',sans-serif}h1,h2,h3{font-family:'SimSun','Noto Serif CJK SC',serif;line-height:1.6;break-after:avoid;overflow-wrap:anywhere}h1{font-size:30px;margin:8px 0 16px}h2{font-size:23px;color:#a34136;border-bottom:1px solid #dcc7a6;padding-bottom:6px;margin:26px 0 14px}h3{font-size:18px;color:#a34136;margin:21px 0 8px}p{margin:8px 0 15px;white-space:pre-wrap;overflow-wrap:anywhere;orphans:3;widows:3}.meta{color:#665649;font-size:14px;line-height:1.8}.cover{height:255mm;border:2px solid #c4a679;background:#7e392e;color:#f8e8ca;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;break-after:page;padding:16mm}.brand{position:relative;width:54mm;height:54mm;overflow:hidden;border-radius:8mm;background:#fffaf0;margin-bottom:12mm}.brand img{position:absolute;width:163%;height:163%;left:-31.5%;top:-31.5%;object-fit:cover}.cover h1{font-size:40px;letter-spacing:8px;margin:8mm 0}.cover small{letter-spacing:3px}.cover p{color:#f4dfbb}.cover .line{height:1px;width:30mm;background:#c4a679;margin:10mm 0}.toc{break-after:page}.toc ol{padding-left:28px}.toc li{margin:12px 0;overflow-wrap:anywhere}article{break-before:page}.entry-heading{border-bottom:1px solid #dcc7a6;margin-bottom:18px}.entry-heading small{font-size:13px;color:#776a5b;letter-spacing:2px}figure{margin:18px 0;break-inside:avoid}figure img{display:block;width:100%;height:auto;max-height:85mm;object-fit:contain;background:#f0e7d7;border-radius:4px}figcaption{font-size:12px;color:#776a5b;text-align:center;margin-top:6px}table{border-collapse:collapse;width:100%;margin:12px 0 25px;table-layout:fixed}thead{display:table-header-group}th,td{text-align:left;border-bottom:1px solid #dfd0b8;padding:9px 12px;overflow-wrap:anywhere}th{background:#eee3cf;color:#665649}tr{break-inside:avoid}ol{padding-left:25px}li{overflow-wrap:anywhere}a{color:inherit}
 </style></head><body><section class="cover"><div class="brand"><img src="xstx-media://assets/logo.png" alt="笑食天下"></div><small>A TASTE OF YOUR LIFE</small><h1>${title}</h1><p>笑食天下 · 我的私人美食之书</p><div class="line"></div><p>${esc(range)} · 收录 ${entries.length} ${scope.kind==='recipes'?'份食谱':scope.kind==='feasts'?'顿好饭':'道美味'}</p><p>把喜欢的味道，好好收藏。</p><small>${esc(date)}</small></section><section class="toc"><h1>${title} · 目录</h1><p class="meta">${esc(range)} · ${entries.length} 个章节</p><ol>${entries.map(r=>'<li>'+esc(r.name||r.title||r.type)+'</li>').join('')}</ol></section>${body}</body></html>`};
}
function createBookPdfExporter({BrowserWindow,dialog,loadState}){
 let busy=false;
 return async function exportBook(parent,scope){
  if(busy)throw Error('正在生成 PDF，请稍候。');busy=true;let printer;
  try{
   const state=loadState();if(!state)throw Error('暂时没有可以导出的菜单。');
   const book=buildBookHtml(state,scope);
   const result=await dialog.showSaveDialog(parent,{title:'保存整本菜单为 PDF',defaultPath:'笑食天下-'+book.title+'-'+new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Shanghai'})+'.pdf',filters:[{name:'PDF 文档',extensions:['pdf']}],properties:['showOverwriteConfirmation','createDirectory']});
   if(result.canceled||!result.filePath||parent.isDestroyed())return {canceled:true};
   printer=new BrowserWindow({show:false,width:900,height:1000,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,spellcheck:false,backgroundThrottling:false}});
   printer.webContents.setWindowOpenHandler(()=>({action:'deny'}));
   await printer.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(book.html));
   printer.webContents.on('will-navigate',e=>e.preventDefault());
   await printer.webContents.executeJavaScript(`(async()=>{await document.fonts.ready;const images=[...document.images];await Promise.all(images.map(image=>image.decode().catch(()=>{})));return images.filter(image=>!image.complete||!image.naturalWidth).length})()` ).then(failed=>{if(failed)throw Error('有 '+failed+' 张照片无法读取，请确认原照片存在后再导出。');});
   const bytes=await printer.webContents.printToPDF({printBackground:true,preferCSSPageSize:true,displayHeaderFooter:true,headerTemplate:'<span></span>',footerTemplate:'<div style="width:100%;font:9px sans-serif;color:#776a5b;text-align:center">笑食天下 · '+esc(book.title)+'　<span class="pageNumber"></span> / <span class="totalPages"></span></div>',generateDocumentOutline:true});
   if(parent.isDestroyed())return {canceled:true};
   const target=/\.pdf$/i.test(result.filePath)?result.filePath:result.filePath+'.pdf';
   atomic(target,bytes);return {canceled:false,path:target};
  }finally{if(printer&&!printer.isDestroyed())printer.destroy();busy=false;}
 };
}
module.exports={buildBookHtml,selectEntries,photoUrl,createBookPdfExporter};
