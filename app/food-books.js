(function(){
 'use strict';
 // Install this example once per library; a saved deletion must remain a deletion.
 if(!desktopReadOnly){const withExample=RecipeModel.withExample(state);if(withExample!==state)commit(withExample);}
 const books={flavors:{nav:'翻阅美味',title:'山珍海味',en:'THE FLAVORS YOU LOVE',unit:'道美味'},recipes:{nav:'翻阅食谱',title:'独家食谱',en:'RECIPES FROM YOUR KITCHEN',unit:'份食谱'},feasts:{nav:'翻阅盛宴',title:'欢聚一堂',en:'GATHER AROUND THE TABLE',unit:'顿好饭'}};
 let kind='flavors',expanded=true,cache=null,memories={flavors:{index:state.readingPositions?.flavors??state.bookIndex??0,cover:true,category:'全部'}};
 const baseList=bookDishes,baseRenderBook=renderBook,baseRender=render,baseSave=save,baseSetView=setView,baseCatalog=catalog,baseRenderForm=renderForm,baseOpenDish=openDish,baseValidBackup=validBackup;
 const getRecipes=()=>state.recipes||[];
 const text=(value,title='')=>({type:'text',text:value||'',title});
 const photo=(src,title)=>({type:'photo',src,title});
 const meta=value=>({type:'meta',text:value});
 const blockHtml=b=>b.type==='photo'?`<figure class="chapter-photo"><img src="${img(b.src)}" alt="${esc(b.title)}"><figcaption>${esc(b.title)}</figcaption></figure>`:b.type==='ingredient'?`<div class="chapter-block chapter-ingredient"><span>${esc(b.name)}</span><span>${esc(b.amount||'用量待补充')}</span></div>`:b.type==='action'?`<div class="chapter-block"><button class="btn outline small" data-action="openDish" data-id="${esc(b.id)}">查看菜品收藏 ${icon('arrow')}</button></div>`:`<section class="chapter-block ${b.type==='meta'?'chapter-meta':''}">${b.title?`<h3>${esc(b.title)}</h3>`:''}<p>${esc(b.text)}</p></section>`;
 const coverContents=()=>`<div class="cover-border">${logoHtml()}<h2 class="cover-book-name">${books[kind].title}</h2><p>A TASTE OF YOUR LIFE<br>${kind==='recipes'?'把拿手的味道，认真记下来':kind==='feasts'?'把相聚的时刻，好好收藏':'私人美食收藏'}</p><div class="cover-open-hint">翻开第一页 ${icon('arrow')}</div><div class="cover-bottom">一餐一味 · 一页一念</div></div>`;
 const items=()=>kind==='recipes'?[...getRecipes()].sort((a,b)=>b.created.localeCompare(a.created)):kind==='feasts'?[...state.meals].sort((a,b)=>b.date.localeCompare(a.date)):baseList();
 function geometry(){
  const full=document.body.classList.contains('book-fullscreen');
  const main=document.getElementById('main'),style=getComputedStyle(main);
  const w=full?innerWidth-(innerWidth<=1150?36:56):main.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);
  const stagePadding=full?(innerHeight<=700?24:innerWidth<=1150?30:44):44;
  const height=full?Math.min(850,innerHeight-(innerHeight<=700?118:innerWidth<=1150?150:173)-stagePadding):Math.max(440,Math.min(innerWidth*.36,550));
  return {width:Math.min(full?1480:Infinity,w-stagePadding),height,full};
 }
 function pageSheet(side,content,entry,pageNo=0){
  if(content.hero)return `<div class="book-${side} chapter-hero ${content.src?'':'photo-pending'}"><img class="book-photo" src="${img(content.src||'')}" alt="${esc(content.caption||entry.name)}"><div class="chapter-hero-copy"><small>${books[kind].title} · ${esc(content.label||'私人珍藏')}</small><h2>${esc(content.caption||entry.name)}</h2><p>${esc(content.sub||'每一页，都有值得留下的味道。')}</p></div></div>`;
  return `<div class="book-${side} chapter-sheet"><header class="chapter-heading"><small>${books[kind].title} / ${esc(content.section||'珍藏续页')}</small><h2>${esc(entry.name)}</h2></header><div class="chapter-flow">${content.blocks.map(blockHtml).join('')}</div><footer class="chapter-footer"><span>${esc(content.section||'慢慢翻，慢慢回味')}</span><span>— ${String(pageNo).padStart(2,'0')} —</span></footer></div>`;
 }
 function paginate(blocks,entry,section,measure){
  const result=[];let current=[];
  function fits(candidate){measure.innerHTML=pageSheet('right',{blocks:candidate,section},entry);const flow=measure.querySelector('.chapter-flow');return flow.scrollHeight<=flow.clientHeight+1;}
  function flush(){if(current.length){result.push({blocks:current,section});current=[];}}
  const queue=blocks.filter(b=>b.type!=='text'||b.text||b.title).map(b=>({...b}));
  while(queue.length){const b=queue.shift();if(fits([...current,b])){current.push(b);continue;}
   if((b.type==='text'||b.type==='meta')&&b.text.length>1){
    const chars=Array.from(b.text);let lo=1,hi=chars.length-1,best=0;
    while(lo<=hi){const mid=Math.floor((lo+hi)/2);if(fits([...current,{...b,text:chars.slice(0,mid).join('')}])){best=mid;lo=mid+1;}else hi=mid-1;}
    if(current.length&&best<20){flush();queue.unshift(b);continue;}
    best=Math.max(1,best);
    current.push({...b,text:chars.slice(0,best).join('')});flush();queue.unshift({...b,text:chars.slice(best).join(''),title:b.title?b.title.replace(/（续）$/,'')+'（续）':''});
   }else if(current.length){flush();queue.unshift(b);}else {current.push(b);flush();}
  }
  flush();return result.length?result:[{blocks:[text('内容可以以后慢慢补充。')],section}];
 }
 function buildPages(){
  const g=geometry(),list=items(),signature=`${kind}|${g.width}|${g.height}|${g.full}`;
  if(cache&&cache.state===state&&cache.signature===signature)return cache.pages;
  const measure=document.createElement('div');measure.className='book chapter-measure';
  Object.assign(measure.style,{width:g.width+'px',height:g.height+'px',display:'block'});
  // Measuring one physical sheet with the same classes keeps pagination tied to typography.
  document.body.append(measure);
  const originalWidth=g.width;
  measure.style.width=(originalWidth/2)+'px';
  const pages=[];
  for(const [entryIndex,item] of list.entries()){
   const entry={id:item.id,name:item.name||item.title||item.type,cover:kind==='recipes'?item.cover:(item.photos||[])[0]||'',entryIndex};
   const sheets=[];
   const pack=(blocks,section)=>sheets.push(...paginate(blocks,entry,section,measure));
   if(kind==='recipes'){
    sheets.push({hero:true,src:item.cover,caption:item.name,label:'我的拿手好味',sub:[item.servings&&'份量 '+item.servings,item.duration&&'用时 '+item.duration].filter(Boolean).join(' · ')});
    const intro=[meta([item.servings&&'份量：'+item.servings,item.duration&&'用时：'+item.duration].filter(Boolean).join('   ')||'份量与用时可以稍后补充。')];
    if(item.description)intro.push(text(item.description,'这道菜的故事'));
    intro.push(text('', '食材与用量'));
    intro.push(...(item.ingredients.length?item.ingredients.map(i=>i.name.length+i.amount.length>80?text(i.name+'：'+(i.amount||'用量待补充'),'食材与用量'):{type:'ingredient',...i}):[text('食材还没记好，可以从「编辑食谱」继续补充。')]));
    if(item.dishId&&dishBy(item.dishId))intro.push({type:'action',id:item.dishId});
    pack(intro,'食材');
    for(const [i,step] of item.steps.entries())pack([...step.photos.map((p,j)=>photo(p,`步骤 ${i+1} · 配图 ${j+1}`)),text(step.text||'步骤说明待补充',`步骤 ${i+1}`)],`步骤 ${i+1}`);
    if(item.tips)pack([text(item.tips,'心得与小贴士')],'心得');
   }else{
    const records=state.records.filter(r=>r.mealId===item.id);
    const cover=(item.photos||[])[0]||records.flatMap(r=>r.photos)[0]||records.map(r=>dishBy(r.dishId)?.cover).find(Boolean)||'';
    entry.cover=cover;
    sheets.push({hero:true,src:cover,caption:entry.name,label:item.date+' · '+item.type,sub:item.place||'这一桌的相聚，值得好好收藏。'});
    const info=[meta([item.date,item.type,item.place&&'地点：'+item.place,item.maker&&'制作者：'+item.maker].filter(Boolean).join('\n'))];
    info.push(text(records.map((r,i)=>`${String(i+1).padStart(2,'0')}  ${dishBy(r.dishId)?.name||'美味收藏'}`).join('\n')||'逐道菜品可以以后再补。','这一桌的菜单'));
    if(item.note)info.push(text(item.note,'这一餐的回忆'));
    pack(info,'饭局总览');
    for(const [i,p] of (item.photos||[]).slice(1).entries())sheets.push({hero:true,src:p,caption:entry.name,label:`整桌照片 ${i+2} / ${item.photos.length}`,sub:'把满桌好菜与相聚的气氛一起留下。'});
    for(const record of records){const dish=dishBy(record.dishId);if(!dish)continue;
     sheets.push({hero:true,src:record.photos[0]||dish.cover,caption:dish.name,label:'这一餐的味道',sub:record.photos.length?'这顿饭当时拍下的照片':'当次未拍照，使用菜品封面'});
     const detail=[meta([record.date,dish.category,...dish.tags.map(t=>'#'+t)].filter(Boolean).join(' · ')),text(record.note||'当次感受还没有填写。','这一口的感受')];
     if(dish.description)detail.push(text(dish.description,'关于这道菜'));
     detail.push({type:'action',id:dish.id});pack(detail,dish.name);
     for(const [i,p] of record.photos.slice(1).entries())sheets.push({hero:true,src:p,caption:dish.name,label:`当次照片 ${i+2} / ${record.photos.length}`,sub:item.date+' · '+entry.name});
    }
   }
   const count=Math.ceil(sheets.length/2);
   for(let i=0;i<sheets.length;i+=2)pages.push({...entry,localIndex:i/2,total:count,left:sheets[i],right:sheets[i+1]||{blocks:[text('把喜欢的味道与相聚的时刻，留在这一页。')],section:'本章留白'},section:sheets[i+1]?.section||sheets[i].section||'相册'});
  }
  measure.remove();cache={signature,state,pages};return pages;
 }
 function spread(page,index){return `<div class="book chapter-book" id="bookSpread">${pageSheet('left',page.left,page,index*2+1)}${pageSheet('right',page.right,page,index*2+2)}</div>`;}
 bookDishes=function(){return kind==='flavors'?baseList():buildPages();};
 function remember(){if(view!=='book')return;memories[kind]={index:state.bookIndex||0,cover:bookCover,category:bookCategory};}
 save=function(){
  if(view==='book'){const positions={...(state.readingPositions||{})};positions[kind]=state.bookIndex||0;state.readingPositions=positions;}
  return baseSave();
 };
 function selectBook(next){
  if(!books[next]||bookBusy)return;
  remember();kind=next;cache=null;expanded=true;
  const memory=memories[kind];state.bookIndex=memory?.index??state.readingPositions?.[kind]??(kind==='flavors'?state.bookIndex:0)??0;
  bookCategory=memory?.category||'全部';
  if(view!=='book')baseSetView('book');
  bookCover=memory?.cover??true;render();window.scrollTo(0,0);
 }
 setView=function(next){remember();baseSetView(next);};
 function entryJump(index){if(bookBusy)return;state.bookIndex=index;bookCover=false;if(save()){document.getElementById('auxDialog').close();render();}}
 renderBook=function(){
  if(kind==='flavors')return baseRenderBook().replace('<h1>翻阅菜单</h1>','<h1>翻阅美味</h1>');
  const list=bookDishes();state.bookIndex=Math.max(0,Math.min(state.bookIndex||0,list.length-1));const page=list[state.bookIndex],b=books[kind];
  const empty=`<div class="empty">${icon(kind==='recipes'?'book':'bowl')}<h3>${kind==='recipes'?'你的独家食谱，等你来写':'相聚的一餐，值得收藏'}</h3><p>${kind==='recipes'?'先记下菜名，食材和步骤都可以慢慢补。':'在「记录一顿饭」里留下整桌照片和用餐信息，这里会自动成册。'}</p><button class="btn outline" data-action="${kind==='recipes'?'newRecipe':'newFeast'}">${kind==='recipes'?'写第一份食谱':'记录一顿饭'}</button></div>`;
  const locked=bookBusy?'disabled':'';
  const currentLabel=!page?'等待收录':bookCover?'封面':`第 ${page.entryIndex+1} ${kind==='recipes'?'份':'顿'} · ${page.localIndex+1} / ${page.total} 页`;
  return pageHead(b.nav,b.en,kind==='recipes'?'把拿手的味道，写成自己的独家食谱。':'一顿饭，一次相聚，一章值得回味的时光。',`${items().length} ${b.unit}`)+`<div class="book-toolbar"><div class="chapter-controls"><button class="btn outline small" data-action="bookCatalog" ${locked}>${icon('list')} ${kind==='recipes'?'食谱':'盛宴'}目录</button><button class="btn outline small" data-action="toggleBookCover" ${locked||!list.length?'disabled':''}>${bookCover?'打开书页':'查看封面'}</button><button class="btn outline small" data-action="${kind==='recipes'?'newRecipe':'newFeast'}" ${locked}>${icon('plus')} ${kind==='recipes'?'新增食谱':'记录一顿饭'}</button>${!bookCover&&page?`<button class="btn outline small" data-action="${kind==='recipes'?'editRecipe':'editFeastBook'}" data-id="${esc(page.id)}" ${locked}>${icon('edit')} ${kind==='recipes'?'编辑食谱':'编辑这一餐'}</button>${kind==='recipes'?`<button class="btn danger-outline small" data-action="deleteRecipe" data-id="${esc(page.id)}" ${locked}>删除食谱</button>`:''}`:''}</div></div><section class="book-stage" aria-busy="${bookBusy}">${!list.length?empty:bookCover?`<button class="book-cover" data-action="openBookAnimated" aria-label="翻开${b.title}到第一页">${coverContents()}</button>`:spread(page,state.bookIndex)}</section><div class="book-nav">${!bookCover&&page?`<div class="chapter-nav-extra"><button class="btn text small" data-action="previousChapter" ${locked||page.entryIndex===0?'disabled':''}>上一${kind==='recipes'?'份':'顿'}</button></div>`:''}<button class="btn outline" data-action="prevBook" ${locked||bookCover||state.bookIndex===0||!list.length?'disabled':''}>${icon('left')} 上一页</button><span class="position">${currentLabel}</span><button class="btn outline" data-action="${bookCover?'openBookAnimated':'nextBook'}" ${locked||!list.length||(!bookCover&&state.bookIndex===list.length-1)?'disabled':''}>${bookCover?'翻开第一页':'下一页'} ${icon('right')}</button>${!bookCover&&page?`<div class="chapter-nav-extra"><button class="btn text small" data-action="nextChapter" ${locked||page.entryIndex===items().length-1?'disabled':''}>下一${kind==='recipes'?'份':'顿'}</button></div>`:''}</div><p class="book-tip">${icon('book')} ← → 翻页 · 从目录直接跳到章节</p>`+foot();
 };
 catalog=function(){if(kind==='flavors'){baseCatalog();return;}
  const list=bookDishes(),dialog=document.getElementById('auxDialog');dialog.style.width='620px';
  dialog.innerHTML=`<div class="dialog-head"><div><h2>${books[kind].title} · 目录</h2><p>选择一章，也可以直接跳到食材、步骤或饭局续页。</p></div><button class="icon-btn" data-action="close" aria-label="关闭目录">${icon('close')}</button></div><div class="dialog-body">${list.map((p,i)=>({p,i})).filter(({p})=>p.localIndex===0).map(({p,i})=>`<section class="book-catalog-entry"><button data-action="chapterJump" data-index="${i}"><img src="${img(p.cover)}" alt=""><span><h3>${esc(p.name)}</h3><small>${p.total} 个跨页 · ${kind==='feasts'?esc(mealBy(p.id)?.date||''):'我的独家食谱'}</small></span></button><div class="book-catalog-jumps">${list.map((p,j)=>({p,j})).filter(x=>x.p.id===p.id).map(({p,j})=>`<button data-action="chapterJump" data-index="${j}">${esc(p.section)} · ${p.localIndex+1}</button>`).join('')}</div></section>`).join('')||'<p class="status-note">这里还没有内容，先添加第一份珍藏。</p>'}</div>`;dialog.showModal();
 };
 function updateNavigation(){
  document.querySelectorAll('[data-book-kind]').forEach(b=>{b.classList.toggle('active',view==='book'&&kind===b.dataset.bookKind);b.setAttribute('aria-current',view==='book'&&kind===b.dataset.bookKind?'page':'false');});
  const parent=document.querySelector('.book-group-toggle');parent.classList.toggle('active',view==='book');parent.setAttribute('aria-expanded',String(expanded));document.getElementById('bookSubnav').hidden=!expanded;
  if(view!=='book')return;
  document.getElementById('breadcrumb').textContent='翻阅菜单 / '+books[kind].nav;
  const toolbar=document.querySelector('.book-toolbar');if(toolbar)toolbar.dataset.bookTitle='笑食天下 · '+books[kind].nav;
  if(kind!=='flavors'){
   const count=document.querySelector('.reading-count');if(count)count.innerHTML=`${items().length}<small>${books[kind].unit}</small>`;
   const left=document.querySelector('.reading-left h2');if(left)left.innerHTML=kind==='recipes'?'把拿手的味道<br>写成独家食谱。':'把相聚的时光<br>装订成册。';
   const right=document.querySelector('.reading-right>p:last-child');if(right)right.innerHTML=kind==='recipes'?'一味一方，<br>记下自己的好手艺。':'满桌好菜，<br>满心欢喜。';
   const tip=document.querySelector('.book-tip');if(tip&&!bookCover)tip.innerHTML=`${icon('book')} ← → 翻页 · 目录跳转章节${document.body.classList.contains('book-fullscreen')?' · Esc 退出全屏':''}`;
  }
 }
 render=function(){if(view!=='book')cache=null;baseRender();updateNavigation();};
 const parent=document.querySelector('[data-view="book"]');parent.removeAttribute('data-view');parent.classList.add('book-group-toggle');parent.dataset.action='booksToggle';parent.setAttribute('aria-controls','bookSubnav');parent.insertAdjacentHTML('beforeend','<svg class="book-chevron" viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg>');
 parent.insertAdjacentHTML('afterend',`<div class="book-subnav" id="bookSubnav">${Object.entries(books).map(([k,b])=>`<button type="button" data-action="selectBook" data-book-kind="${k}">${b.nav}</button>`).join('')}</div>`);
 renderForm=function(){baseRenderForm();const tabs=document.querySelector('#recordForm .form-tabs');if(tabs)tabs.insertAdjacentHTML('beforeend','<button type="button" data-action="newRecipeFromForm">写一份食谱</button>');};
 validBackup=function(obj){const safe=p=>typeof p==='string'&&(p===''||Object.hasOwn(ASSETS,p)||/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p));return baseValidBackup(obj)&&RecipeModel.validateRecipes(obj.data,safe);};
 openDish=function(id){baseOpenDish(id);const linked=getRecipes().filter(r=>r.dishId===id),summary=document.querySelector('#detailDialog .detail-summary');if(!summary)return;summary.insertAdjacentHTML('beforeend',`<section class="recipe-linked"><h3>我的独家食谱</h3><div class="chapter-controls">${linked.map(r=>`<button class="btn outline small" data-action="readRecipe" data-id="${esc(r.id)}">${esc(r.name)} ${icon('arrow')}</button>`).join('')}<button class="btn text small" data-action="recipeFromDish" data-id="${esc(id)}">${icon('plus')} 写下做法</button></div></section>`);};
 const editor=document.createElement('dialog');editor.id='recipeDialog';editor.className='recipe-dialog';editor.setAttribute('aria-label','食谱编辑');document.body.append(editor);
 let draft=null,lastPhoto='cover',queue=Promise.resolve(),pending=0;
 function captureDraft(){if(!draft)return;const form=editor.querySelector('form');if(!form)return;
  for(const key of ['name','description','servings','duration','tips','dishId'])draft[key]=form.elements[key].value;
  draft.ingredients=[...form.querySelectorAll('.recipe-ingredient-row')].map(row=>({name:row.querySelector('[data-field=name]').value,amount:row.querySelector('[data-field=amount]').value}));
  for(const step of draft.steps){const field=form.querySelector(`[data-step-text="${step.id}"]`);if(field)step.text=field.value;}
 }
 function photoSlot(target,photos,cover=false){return `<section class="recipe-photo-slot" tabindex="0" data-recipe-photo="${target}"><div class="recipe-photo-tools"><label class="btn outline small">${icon('image')} ${cover?'选择成品图':'添加步骤图'}<input type="file" accept="image/jpeg,image/png,image/webp" ${cover?'':'multiple'} data-recipe-file="${target}"></label><button type="button" class="btn outline small" data-action="recipePaste" data-target="${target}">粘贴图片</button><small>选填 · 可拖入或 Ctrl+V 粘贴</small></div><div class="recipe-photo-preview">${photos.map((p,i)=>`<span><img src="${img(p)}" alt="${cover?'成品图':'步骤配图'} ${i+1}"><button type="button" data-action="recipeRemovePhoto" data-target="${target}" data-index="${i}" aria-label="移除图片 ${i+1}">×</button></span>`).join('')}</div></section>`;}
 function renderEditor(){
  const d=draft;editor.innerHTML=`<div class="dialog-head"><div><h2>${d.editing?'编辑食谱':'写一份独家食谱'}</h2><p>先记下拿手的味道，食材与步骤都可以慢慢补。</p></div><button class="icon-btn" data-action="close" aria-label="关闭食谱编辑">${icon('close')}</button></div><form id="recipeForm"><div class="dialog-body"><div class="field"><label for="recipeName">菜名<i>*</i></label><input id="recipeName" name="name" required maxlength="60" value="${esc(d.name)}" placeholder="这道拿手菜，叫什么？"></div>${photoSlot('cover',d.cover?[d.cover]:[],true)}<div class="form-row" style="margin-top:20px"><div class="field"><label for="recipeServings">份量</label><input id="recipeServings" name="servings" maxlength="60" value="${esc(d.servings)}" placeholder="例如：2 人份"></div><div class="field"><label for="recipeDuration">预计用时</label><input id="recipeDuration" name="duration" maxlength="60" value="${esc(d.duration)}" placeholder="例如：30 分钟"></div></div><div class="field"><label for="recipeDescription">这道菜的故事</label><textarea id="recipeDescription" name="description" maxlength="4000">${esc(d.description)}</textarea></div><div class="field"><label for="recipeDishId">关联美食（选填）</label><select id="recipeDishId" name="dishId"><option value="">独立保存，暂不关联</option>${state.dishes.map(item=>`<option value="${item.id}" ${item.id===d.dishId?'selected':''}>${esc(item.name)}</option>`).join('')}</select><p class="status-note">只建立查看入口，后续编辑互不影响。可点击下方按钮复制当前菜名和封面。</p><button type="button" class="btn outline small" data-action="recipeCopyDish">复制关联美食的菜名与封面</button></div><section class="recipe-editor-section"><header><h3>食材与用量</h3><button type="button" class="btn outline small" data-action="recipeAddIngredient">${icon('plus')} 添加食材</button></header>${d.ingredients.map((i,n)=>`<div class="recipe-ingredient-row"><input data-field="name" maxlength="120" value="${esc(i.name)}" placeholder="食材名称" aria-label="食材 ${n+1} 名称"><input data-field="amount" maxlength="120" value="${esc(i.amount)}" placeholder="例如：2 个／适量" aria-label="食材 ${n+1} 用量"><button type="button" class="icon-btn" data-action="recipeRemoveIngredient" data-index="${n}" aria-label="移除食材 ${n+1}">${icon('close')}</button></div>`).join('')}</section><section class="recipe-editor-section"><header><h3>制作步骤</h3><button type="button" class="btn outline small" data-action="recipeAddStep">${icon('plus')} 添加步骤</button></header>${d.steps.map((step,i)=>`<section class="recipe-step" data-step-id="${step.id}"><header><span>步骤 ${String(i+1).padStart(2,'0')}</span><button type="button" class="btn outline small" data-action="recipeMoveStep" data-id="${step.id}" data-direction="-1" ${i===0?'disabled':''}>上移</button><button type="button" class="btn outline small" data-action="recipeMoveStep" data-id="${step.id}" data-direction="1" ${i===d.steps.length-1?'disabled':''}>下移</button><button type="button" class="icon-btn" data-action="recipeRemoveStep" data-id="${step.id}" aria-label="移除步骤 ${i+1}">${icon('close')}</button></header><textarea data-step-text="${step.id}" maxlength="8000" aria-label="步骤 ${i+1} 说明" placeholder="写下这一步的做法、火候和时间…">${esc(step.text)}</textarea>${photoSlot(step.id,step.photos)}</section>`).join('')}</section><div class="field"><label for="recipeTips">心得与小贴士</label><textarea id="recipeTips" name="tips" maxlength="8000" placeholder="成功的窍门、踩过的坑，下次想调整什么…">${esc(d.tips)}</textarea></div><p id="recipeError" class="error" role="alert"></p></div><div class="dialog-actions"><small id="recipePhotoStatus">${pending?'正在处理图片…':'自动保存到本机资料库，照片随完整备份一起导出。'}</small><button type="button" class="btn outline" data-action="close">取消</button><button type="submit" class="btn primary" ${pending?'disabled':''}>保存食谱</button></div></form>`;
  editor.querySelector('form').onsubmit=event=>{event.preventDefault();if(pending)return;captureDraft();const recipe=structuredClone(draft);delete recipe.editing;recipe.name=recipe.name.trim();if(!recipe.name){editor.querySelector('#recipeError').textContent='请填写菜名。';return;}
   recipe.dishId=recipe.dishId||null;recipe.ingredients=recipe.ingredients.map(i=>({name:i.name.trim(),amount:i.amount.trim()})).filter(i=>i.name||i.amount);if(recipe.ingredients.some(i=>!i.name)){editor.querySelector('#recipeError').textContent='填写了用量的食材，请补上名称。';return;}
   recipe.steps=recipe.steps.filter(s=>s.text.trim()||s.photos.length);recipe.updated=new Date().toISOString();const next=structuredClone(state);next.recipes=next.recipes||[];const at=next.recipes.findIndex(r=>r.id===recipe.id);if(at<0)next.recipes.push(recipe);else next.recipes[at]=recipe;
   if(!commit(next))return;editor.close();cache=null;selectBook('recipes');const index=bookDishes().findIndex(p=>p.id===recipe.id);entryJump(Math.max(0,index));toast('食谱已收好，食材和步骤都保存在这本书里。');
  };
 }
 function openRecipe(id=null,dishId=null){
  const existing=getRecipes().find(r=>r.id===id),dish=dishBy(dishId);
  draft=existing?{...structuredClone(existing),editing:true}:{id:uid(),name:dish?.name||'',cover:dish?.cover||'',description:'',servings:'',duration:'',tips:'',dishId:dish?.id||null,created:new Date().toISOString(),updated:new Date().toISOString(),ingredients:[{name:'',amount:''}],steps:[{id:uid(),text:'',photos:[]}]};
  lastPhoto='cover';pending=0;queue=Promise.resolve();renderEditor();editor.showModal();
 }
 function targetPhotos(target,d=draft){if(target==='cover')return {photos:d.cover?[d.cover]:[],set:p=>d.cover=p[0]||''};const step=d.steps.find(s=>s.id===target);return step?{photos:step.photos,set:p=>step.photos=p}:null;}
 function importRecipePhotos(target,files){const current=draft,list=[...files];if(!current||!list.length)return Promise.resolve(false);pending++;editor.querySelector('[type=submit]').disabled=true;editor.querySelector('#recipePhotoStatus').textContent='正在处理图片…';
  const task=queue.then(async()=>{if(draft!==current||!editor.open)return false;try{const slot=targetPhotos(target,current);if(!slot)return false;if(target==='cover'&&list.length!==1)throw Error('成品封面请选择一张照片。');if(target!=='cover'&&slot.photos.length+list.length>12)throw Error('每个步骤最多添加 12 张配图。');const images=await filesToPhotos(list);if(draft!==current||!editor.open||!targetPhotos(target,current))return false;if(target!=='cover'&&slot.photos.length+images.length>12)throw Error('每个步骤最多添加 12 张配图。');captureDraft();slot.set(target==='cover'?images:[...slot.photos,...images]);renderEditor();return true;}catch(e){if(draft===current&&editor.open)editor.querySelector('#recipeError').textContent=e.message;return false;}}).finally(()=>{if(draft!==current)return;pending--;if(editor.open){editor.querySelector('[type=submit]').disabled=pending>0;editor.querySelector('#recipePhotoStatus').textContent=pending?'正在处理图片…':'图片已就绪，保存后生效。';}});queue=task;return task;
 }
 editor.addEventListener('close',()=>{if(!editor.open){draft=null;pending=0;queue=Promise.resolve();}});
 for(const eventName of ['pointerdown','focusin'])editor.addEventListener(eventName,event=>{const slot=event.target.closest('[data-recipe-photo]');if(slot)lastPhoto=slot.dataset.recipePhoto;else{const step=event.target.closest('.recipe-step');if(step)lastPhoto=step.dataset.stepId;}});
 editor.addEventListener('change',event=>{const target=event.target.dataset.recipeFile;if(target)void importRecipePhotos(target,event.target.files);});
 editor.addEventListener('dragover',event=>{if(event.target.closest('[data-recipe-photo]'))event.preventDefault();});
 editor.addEventListener('drop',event=>{const slot=event.target.closest('[data-recipe-photo]');if(!slot)return;event.preventDefault();void importRecipePhotos(slot.dataset.recipePhoto,event.dataTransfer.files);});
 editor.addEventListener('paste',event=>{const files=[...(event.clipboardData?.items||[])].filter(i=>i.kind==='file'&&i.type.startsWith('image/')).map(i=>i.getAsFile()).filter(Boolean);if(!files.length)return;event.preventDefault();void importRecipePhotos(lastPhoto,files);});
 const deletion=document.createElement('dialog');deletion.className='confirm-dialog';deletion.id='recipeDeleteDialog';document.body.append(deletion);let deletingId=null,undo=null,undoExpiry=0,undoTimer=null;
 function deleteRecipe(id){const recipe=getRecipes().find(r=>r.id===id);if(!recipe)return;deletingId=id;deletion.innerHTML=`<div class="dialog-head"><h2>删除这份食谱？</h2><button class="icon-btn" data-action="close" aria-label="取消删除">${icon('close')}</button></div><div class="dialog-body"><p>「${esc(recipe.name)}」的食材、步骤和配图会一起移除。关联的美食和品尝记录会保留。</p><p class="status-note">删除前保留完整备份，删除后 30 秒内可以撤销。</p><p class="error" id="recipeDeleteError"></p></div><div class="dialog-actions"><button class="btn outline" data-action="close">先保留</button><button class="btn primary" data-action="confirmRecipeDelete">确认删除</button></div>`;deletion.showModal();}
 function handleAction(button){const action=button.dataset.action,id=button.dataset.id;
  if(action==='booksToggle'){expanded=!expanded;updateNavigation();return;}
  if(action==='selectBook'){selectBook(button.dataset.bookKind);return;}
  if(action==='goBook'){selectBook('flavors');return;}
  if(action==='newRecipeFromForm'){document.getElementById('formDialog').close();openRecipe();return;}
  if(action==='newRecipe'){openRecipe();return;}
  if(action==='editRecipe'){openRecipe(id);return;}
  if(action==='recipeFromDish'){openRecipe(null,id);return;}
  if(action==='readRecipe'){document.getElementById('detailDialog').close();selectBook('recipes');entryJump(Math.max(0,bookDishes().findIndex(p=>p.id===id)));return;}
  if(action==='newFeast'){openForm('meal');return;}
  if(action==='editFeastBook'){openForm('meal',{mealId:id});return;}
  if(action==='chapterJump'){entryJump(Number(button.dataset.index));return;}
  if(action==='previousChapter'||action==='nextChapter'){const list=bookDishes(),entry=list[state.bookIndex];const target=entry.entryIndex+(action==='nextChapter'?1:-1);const index=list.findIndex(p=>p.entryIndex===target);if(index>=0)entryJump(index);return;}
  if(action==='deleteRecipe'){deleteRecipe(id);return;}
  if(action==='confirmRecipeDelete'){
   try{const recipe=getRecipes().find(r=>r.id===deletingId);if(!recipe)return;window.desktop.snapshotBeforeDelete();const next=structuredClone(state);next.recipes=next.recipes.filter(r=>r.id!==deletingId);if(!commit(next))return;clearTimeout(undoTimer);undo=structuredClone(recipe);undoExpiry=Date.now()+30000;undoTimer=setTimeout(()=>{undo=null;},30000);deletion.close();render();toast('这份食谱已删除。');const btn=document.createElement('button');btn.className='undo-button';btn.dataset.action='undoRecipeDelete';btn.textContent='撤销';document.getElementById('toast').append(btn);clearTimeout(toastTimer);toastTimer=setTimeout(()=>document.getElementById('toast').classList.remove('show'),30000);}catch(e){deletion.querySelector('#recipeDeleteError').textContent=e.message;}return;
  }
  if(action==='undoRecipeDelete'){if(!undo||Date.now()>undoExpiry){undo=null;toast('撤销时间已过，可以从删除前的备份恢复。');return;}const next=structuredClone(state);next.recipes=next.recipes||[];if(!next.recipes.some(r=>r.id===undo.id))next.recipes.push(undo);if(commit(next)){undo=null;clearTimeout(undoTimer);render();toast('食谱已找回。');}return;}
  if(!action.startsWith('recipe')||!draft)return;
  captureDraft();const scroll=editor.scrollTop;
  if(action==='recipeAddIngredient'){if(draft.ingredients.length>=200)return;draft.ingredients.push({name:'',amount:''});}
  else if(action==='recipeRemoveIngredient')draft.ingredients.splice(Number(button.dataset.index),1);
  else if(action==='recipeAddStep'){if(draft.steps.length>=200)return;draft.steps.push({id:uid(),text:'',photos:[]});}
  else if(action==='recipeRemoveStep')draft.steps=draft.steps.filter(s=>s.id!==id);
  else if(action==='recipeMoveStep'){const from=draft.steps.findIndex(s=>s.id===id),to=from+Number(button.dataset.direction);if(from>=0&&to>=0&&to<draft.steps.length)[draft.steps[from],draft.steps[to]]=[draft.steps[to],draft.steps[from]];}
  else if(action==='recipeRemovePhoto'){const slot=targetPhotos(button.dataset.target);if(slot)slot.set(slot.photos.filter((_,i)=>i!==Number(button.dataset.index)));}
  else if(action==='recipeCopyDish'){const dish=dishBy(draft.dishId);if(!dish){editor.querySelector('#recipeError').textContent='请先选择要关联的美食。';return;}draft.name=dish.name;draft.cover=dish.cover;}
  else if(action==='recipePaste'){lastPhoto=button.dataset.target;const target=lastPhoto,current=draft;pending++;editor.querySelector('[type=submit]').disabled=true;void(async()=>{try{const data=await window.desktop.readClipboardImage();if(draft!==current||!editor.open)return;if(!data)throw Error('剪贴板里没有图片，请先复制图片或截图。');const bytes=Uint8Array.from(atob(data.split(',')[1]),c=>c.charCodeAt(0));await importRecipePhotos(target,[new File([bytes],'粘贴图片.png',{type:'image/png'})]);}catch(e){if(draft===current&&editor.open)editor.querySelector('#recipeError').textContent=e.message;}finally{if(draft===current){pending--;if(editor.open)editor.querySelector('[type=submit]').disabled=pending>0;}}})();return;}
  renderEditor();editor.scrollTop=scroll;
 }
 const ownActions=new Set(['booksToggle','selectBook','goBook','newRecipeFromForm','newRecipe','editRecipe','recipeFromDish','readRecipe','newFeast','editFeastBook','chapterJump','previousChapter','nextChapter','deleteRecipe','confirmRecipeDelete','undoRecipeDelete']);
 document.addEventListener('click',event=>{const button=event.target.closest('[data-action]');if(!button||button.disabled)return;const a=button.dataset.action;if(!ownActions.has(a)&&!a.startsWith('recipe'))return;event.preventDefault();event.stopImmediatePropagation();handleAction(button);},true);
 for(const dialog of [editor,deletion])dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
 window.addEventListener('resize',()=>{const selected=cache?.pages[state.bookIndex];cache=null;if(view==='book'&&kind!=='flavors'&&!bookBusy){requestAnimationFrame(()=>{if(view!=='book'||bookBusy)return;cache=null;const list=bookDishes();if(selected){let at=list.findIndex(p=>p.id===selected.id&&p.localIndex===selected.localIndex);if(at<0)at=list.findIndex(p=>p.id===selected.id);if(at>=0)state.bookIndex=at;}render();});}});
 const previousRestore=restoreState;restoreState=function(next){const ok=previousRestore(next);if(ok){undo=null;clearTimeout(undoTimer);cache=null;}return ok;};
 globalThis.FoodBooks={coverContents,select:selectBook,get kind(){return kind},get pages(){return bookDishes()},openRecipe,importRecipePhotos,invalidate:()=>cache=null};
 render();
})();
