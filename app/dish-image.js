(function(){
 'use strict';
 const baseOpen=openDish;
 const WIDTH=1200,MARGIN=64,INK='#45382d',MUTED='#957b5e',RED='#923e34',PAPER='#fffaf0';
 const sans='"Microsoft YaHei",sans-serif',serif='"SimSun",serif';
 let copying=false;
 function lines(ctx,value,width,font){
  ctx.font=font;const result=[];
  for(const paragraph of String(value||'').replace(/\r\n?/g,'\n').split('\n')){
   let line='';for(const char of Array.from(paragraph)){if(line&&ctx.measureText(line+char).width>width){result.push(line);line=char;}else line+=char;}result.push(line);
  }
  return result;
 }
 async function createPicture(dish,records,meals){
  await document.fonts.ready;
  const measure=document.createElement('canvas').getContext('2d'),commands=[],cache=new Map();let missing=0;
  const font=(size,weight=400,family=sans)=>`${weight} ${size}px ${family}`;
  const rect=(x,y,w,h,color,radius=0)=>commands.push(ctx=>{ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,radius);ctx.fill();});
  const rule=y=>rect(MARGIN,y,WIDTH-MARGIN*2,1,'#dfcfb6');
  function words(value,x,y,w,size=25,color=INK,lineHeight=42,weight=400,family=sans){const f=font(size,weight,family),rows=lines(measure,value,w,f);commands.push(ctx=>{ctx.font=f;ctx.textBaseline='top';ctx.fillStyle=color;rows.forEach((line,i)=>ctx.fillText(line,x,y+i*lineHeight));});return rows.length*lineHeight;}
  async function load(src){if(!src)return null;const url=img(src);if(!cache.has(url))cache.set(url,new Promise(resolve=>{const photo=new Image();photo.crossOrigin='anonymous';photo.onload=()=>resolve(photo);photo.onerror=()=>{missing++;resolve(null);};photo.src=url;}));return cache.get(url);}
  function picture(src,x,y,w,h,cover=false){
   rect(x,y,w,h,'#eee3d2',16);
   // Keep only the source in the layout plan, then decode/draw/release each photo.
   // A long history must not retain every full-size bitmap alongside the final canvas.
   commands.push(async ctx=>{
    const photo=await load(src);
    if(!photo){ctx.font=font(25);ctx.textBaseline='top';ctx.fillStyle=MUTED;ctx.fillText('照片待补充',x+24,y+h/2-15);return;}
    try{ctx.save();ctx.beginPath();ctx.roundRect(x,y,w,h,16);ctx.clip();const scale=(cover?Math.max:Math.min)(w/photo.naturalWidth,h/photo.naturalHeight);const iw=photo.naturalWidth*scale,ih=photo.naturalHeight*scale;ctx.drawImage(photo,x+(w-iw)/2,y+(h-ih)/2,iw,ih);ctx.restore();}
    finally{cache.delete(img(src));photo.onload=photo.onerror=null;photo.removeAttribute('src');}
   });
  }
  // Lay out the entire record before allocating the final canvas, independent of dialog scroll.
  const cover=dish.cover;let y=52;
  words('笑食天下',MARGIN,y,500,27,RED,38,600,serif);words('我的私人美食档案',WIDTH-370,y+4,306,17,MUTED,28);y+=64;rule(y);y+=36;
  const heroY=y,photoW=480,gap=44,tx=MARGIN+photoW+gap,tw=WIDTH-MARGIN-tx;
  let textY=y+12;textY+=words('A FLAVOR TO REMEMBER',tx,textY,tw,16,MUTED,26)+18;
  textY+=words(dish.name,tx,textY,tw,46,INK,66,600,serif)+21;
  if(dish.description)textY+=words(dish.description,tx,textY,tw,25,MUTED,43)+20;
  textY+=words([dish.category||'未分类',...dish.tags.map(t=>'#'+t)].join('  ·  '),tx,textY,tw,21,RED,36)+20;
  textY+=words(`品尝过 ${records.length} 次  ·  ${records.reduce((n,r)=>n+r.photos.length,0)} 张品尝照片${dish.favorite?'\n特别喜欢 · 心头好味道':''}`,tx,textY,tw,20,MUTED,34);
  if(dish.created)textY+=18+words('收藏日期  '+dish.created,tx,textY+18,tw,18,MUTED,30);
  const heroH=Math.max(470,textY-heroY+12);picture(cover,MARGIN,heroY,photoW,heroH,true);y=heroY+heroH+42;rule(y);y+=35;
  y+=words('关于它的美味回忆',MARGIN,y,WIDTH-MARGIN*2,34,INK,52,600,serif)+22;
  if(!records.length)y+=words('还没有品尝记录。先把喜欢的味道收藏下来，回忆可以慢慢补。',MARGIN,y,WIDTH-MARGIN*2,25,MUTED,43)+30;
  for(const record of records){
   const meal=meals.find(m=>m.id===record.mealId);
   y+=words(record.date.replaceAll('-',' . '),MARGIN,y,WIDTH-MARGIN*2,21,RED,36,600)+12;
   if(meal){y+=words(meal.title||meal.type,MARGIN,y,WIDTH-MARGIN*2,29,INK,46,600,serif)+8;const details=[meal.type,meal.place&&'地点：'+meal.place,meal.maker&&'制作者：'+meal.maker].filter(Boolean).join('  ·  ');if(details)y+=words(details,MARGIN,y,WIDTH-MARGIN*2,20,MUTED,34)+12;}
   if(record.note)y+=words(record.note,MARGIN,y,WIDTH-MARGIN*2,25,INK,43)+20;
   else y+=words('这次还没有写下感受。',MARGIN,y,WIDTH-MARGIN*2,22,MUTED,36)+16;
   if(record.photos.length){const cols=Math.min(record.photos.length,3),pg=18,pw=(WIDTH-MARGIN*2-(cols-1)*pg)/cols,ph=cols===1?440:cols===2?340:280;
    for(let i=0;i<record.photos.length;i++){picture(record.photos[i],MARGIN+(i%cols)*(pw+pg),y+Math.floor(i/cols)*(ph+pg),pw,ph);}
    y+=Math.ceil(record.photos.length/cols)*(ph+pg)+8;
   }
   y+=22;rule(y);y+=32;
  }
  y+=10;words('把喜欢的味道，好好收藏。',MARGIN,y,WIDTH-MARGIN*2,23,RED,38,500,serif);y+=54;
  words('笑食天下  ·  一餐一味，一页一念',MARGIN,y,WIDTH-MARGIN*2,17,MUTED,28);y+=70;
  // Avoid browser/GPU canvas limits. All content remains in the image, at a reduced scale if needed.
  const scale=Math.min(1,28000/y,Math.sqrt(32*1024*1024/(WIDTH*y)));
  if(scale<.5)throw Error('这道菜的回忆太多，完整图片会过长，暂时无法清晰复制。');
  const canvas=document.createElement('canvas');canvas.width=Math.ceil(WIDTH*scale);canvas.height=Math.ceil(y*scale);const ctx=canvas.getContext('2d');ctx.scale(scale,scale);ctx.fillStyle=PAPER;ctx.fillRect(0,0,WIDTH,y);rect(18,18,5,y-36,'#c4a77e');for(const draw of commands)await draw(ctx);
  try{const result=canvas.toDataURL('image/png');if(result==='data:,')throw Error('图片生成未完成，请重试。');return {url:result,width:canvas.width,height:canvas.height,missing};}
  finally{canvas.width=canvas.height=1;measure.canvas.width=measure.canvas.height=1;cache.clear();commands.length=0;}
 }
 openDish=function(id){baseOpen(id);const buttons=document.querySelector('#detailDialog .detail-summary .buttons');if(!buttons)return;buttons.style.flexWrap='wrap';buttons.insertAdjacentHTML('beforeend',`<button type="button" class="btn outline small dish-copy-image" data-action="copyDishImage" data-id="${esc(id)}" ${copying?'disabled':''}>${icon('image')} ${copying?'正在生成…':'复制为图片'}</button>`);};
 async function copy(id){
  if(copying)return;const dish=dishBy(id);if(!dish){toast('这道菜已经不存在，请重新打开。');return;}
  const snapshot={dish:structuredClone(dish),records:structuredClone(allRecords(id)),meals:structuredClone(state.meals)};
  copying=true;const buttons=[...document.querySelectorAll('[data-action="copyDishImage"]')];buttons.forEach(b=>{b.disabled=true;b.setAttribute('aria-busy','true');b.innerHTML=icon('image')+' 正在生成…';});
  try{await new Promise(resolve=>requestAnimationFrame(resolve));const result=await createPicture(snapshot.dish,snapshot.records,snapshot.meals);await window.desktop.copyImage(result.url);toast(result.missing?'图片已复制；有照片未能读取，已标出占位。':'已复制为图片，可以直接粘贴到微信等应用。');}
  catch(error){toast('复制未完成：'+error.message);}
  finally{copying=false;document.querySelectorAll('[data-action="copyDishImage"]').forEach(b=>{b.disabled=false;b.removeAttribute('aria-busy');b.innerHTML=icon('image')+' 复制为图片';});}
 }
 document.addEventListener('click',event=>{const b=event.target.closest('[data-action="copyDishImage"]');if(!b||b.disabled)return;event.preventDefault();event.stopImmediatePropagation();void copy(b.dataset.id);},true);
 globalThis.DishImage={create:createPicture,copy};
})();
