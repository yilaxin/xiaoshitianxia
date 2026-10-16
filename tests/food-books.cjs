const {app,BrowserWindow,dialog,clipboard,ClipboardItem,nativeImage}=require('electron');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const project=path.resolve(__dirname,'..'),profile=fs.mkdtempSync(path.join(project,'work/food-books-'));
const images=path.join(project,'outputs/v'+require('../package.json').version);fs.mkdirSync(images,{recursive:true});
const backup=path.join(profile,'完整备份.json');dialog.showSaveDialogSync=()=>backup;
assert.equal(typeof clipboard.read,'function');
clipboard.read=async()=>[new ClipboardItem({'image/png':new Blob([nativeImage.createFromPath(path.join(project,'assets/rice.jpg')).toPNG()],{type:'image/png'})})];
process.env.XSTX_HEADLESS_TEST='1';process.argv.push('--data-dir='+profile);require('../dist-app/main.cjs');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
app.whenReady().then(async()=>{try{
 const win=BrowserWindow.getAllWindows()[0],errors=[];
 win.webContents.on('console-message',e=>{if(/Uncaught|TypeError|ReferenceError/.test(e.message)){errors.push(e.message);console.error(e.message)}});
 await new Promise((resolve,reject)=>{win.webContents.once('did-finish-load',resolve);win.webContents.once('did-fail-load',(_e,c,d)=>reject(Error(c+': '+d)))});
 const run=async s=>{try{return await win.webContents.executeJavaScript(s,true)}catch(e){console.error('Failed script:',s.slice(0,500));throw e;}},click=s=>run(`document.querySelector(${JSON.stringify(s)}).click()`);
 const ready=async s=>{for(let i=0;i<150;i++){if(await run(s))return;await pause(30)}throw Error('Timed out: '+s)};
 const capture=async name=>{await pause(250);await win.webContents.capturePage();fs.writeFileSync(path.join(images,name),(await win.webContents.capturePage()).toPNG())};
 await ready(`typeof FoodBooks!=='undefined'`);assert.deepEqual(errors,[]);
 assert.equal(await run(`document.querySelectorAll('[data-book-kind]').length`),3);
 await click('[data-action="booksToggle"]');assert.equal(await run(`document.getElementById('bookSubnav').hidden`),true);await click('[data-action="booksToggle"]');
 await run(`FoodBooks.select('recipes')`);assert.match(await run(`document.getElementById('main').textContent`),/你的独家食谱/);
 await run(`openForm()`);assert.equal(await run(`!!document.querySelector('[data-action="newRecipeFromForm"]')`),true);await click('[data-action="newRecipeFromForm"]');
 await run(`document.getElementById('recipeName').value='妈妈的番茄炒蛋';document.getElementById('recipeServings').value='2 人份';document.getElementById('recipeDuration').value='15 分钟';document.getElementById('recipeDescription').value='家里最熟悉的味道。';document.querySelector('[data-field=name]').value='鸡蛋';document.querySelector('[data-field=amount]').value='3 个';document.querySelector('[data-step-text]').value='打散鸡蛋，加少许盐。';document.getElementById('recipeTips').value='鸡蛋炒到刚刚凝固，口感会更嫩。'`);
 await click('[data-action="recipeAddIngredient"]');assert.equal(await run(`document.getElementById('recipeName').value`),'妈妈的番茄炒蛋');
 await run(`document.querySelectorAll('[data-field=name]')[1].value='番茄';document.querySelectorAll('[data-field=amount]')[1].value='2 个'`);
 await click('[data-action="recipeAddStep"]');await run(`document.querySelectorAll('[data-step-text]')[1].value='炒香番茄，再倒入鸡蛋拌匀。'`);
 await click('[data-action="recipePaste"][data-target="cover"]');await ready(`document.querySelector('[data-recipe-photo=cover] img')`);
 const stepId=await run(`document.querySelectorAll('[data-step-text]')[1].dataset.stepText`);
 await run(`(async()=>{const bytes=new Uint8Array(await (await fetch(ASSETS.salad)).arrayBuffer());return FoodBooks.importRecipePhotos('${stepId}',[new File([bytes],'步骤.jpg',{type:'image/jpeg'})])})()`);
 await click('#recipeForm [type=submit]');await ready(`!document.getElementById('recipeDialog').open`);
 assert.equal(await run('state.recipes.length'),1);const id=await run('state.recipes[0].id');assert.equal(await run('state.recipes[0].steps[1].photos.length'),1);
 assert.equal(await run('FoodBooks.kind'),'recipes');assert.match(await run(`document.querySelector('#bookSpread').textContent`),/食材/);
 await capture('三本书-食谱开篇.png');
 await run(`void flipBook(1)`);await ready('!bookBusy&&state.bookIndex===1');assert.ok(await run(`document.querySelectorAll('#bookSpread .chapter-sheet').length`)>0);await run(`void flipBook(-1)`);await ready('!bookBusy&&state.bookIndex===0');
 await run(`bookCover=true;render()`);await click('[data-action="openBookAnimated"]');await ready(`!!document.querySelector('.book-cover-turner')`);assert.equal(await run(`document.querySelector('.book-front-face .cover-book-name').textContent`),'独家食谱');await ready('!bookBusy');
 const hasAll=await run(`(()=>{const pages=FoodBooks.pages;const blocks=pages.flatMap(p=>[p.left,p.right]).flatMap(s=>s.blocks||[]);return blocks.map(b=>b.text||b.name||b.title||'').join('\\n')})()`);assert.match(hasAll,/打散鸡蛋/);assert.match(hasAll,/炒香番茄/);assert.match(hasAll,/更嫩/);
 // Explicit linking does not synchronize future dish/recipe edits.
 await run(`FoodBooks.openRecipe('${id}')`);await run(`document.getElementById('recipeDishId').value=state.dishes[0].id`);await click('[data-action="recipeCopyDish"]');const linkedName=await run('state.dishes[0].name');assert.equal(await run(`document.getElementById('recipeName').value`),linkedName);
 await run(`document.getElementById('recipeName').value='我的独家做法'`);await click('#recipeForm [type=submit]');await ready(`!document.getElementById('recipeDialog').open`);assert.equal(await run('state.dishes[0].name'),linkedName);
 await run(`openDish(state.dishes[0].id)`);assert.equal(await run(`document.querySelectorAll('[data-action="readRecipe"]').length`),1);await click('[data-action="readRecipe"]');assert.equal(await run('FoodBooks.kind'),'recipes');
 // Long content must survive automatic continuation without being clipped or lost.
 await run(`state.recipes[0].tips='小火慢炒，记住每一步。'.repeat(220);FoodBooks.invalidate();render()`);
 const tips=await run(`FoodBooks.pages.flatMap(p=>[p.left,p.right]).flatMap(s=>s.blocks||[]).filter(b=>b.title?.startsWith('心得')).map(b=>b.text).join('')`);assert.equal(tips,await run('state.recipes[0].tips'));
 const checkFit=async()=>{const n=await run('FoodBooks.pages.length');for(let i=0;i<n;i++){
  await run(`state.bookIndex=${i};bookCover=false;render()`);
  const overflow=await run(`[...document.querySelectorAll('#bookSpread .chapter-flow')].map(e=>({extra:e.scrollHeight-e.clientHeight,h:e.clientHeight}))`);
  assert.ok(overflow.every(x=>x.extra<=2),`Page ${i} overflows: ${JSON.stringify(overflow)}`);
 }};
 await checkFit();
 // Each book remembers its own position and cover state on navigation.
 await run(`FoodBooks.select('flavors')`);assert.match(await run(`document.querySelector('.cover-book-name').textContent`),/山珍海味/);
 await run(`bookCover=false;state.bookIndex=2;render();FoodBooks.select('recipes');FoodBooks.select('flavors')`);assert.equal(await run('state.bookIndex'),2);assert.equal(await run('bookCover'),false);
 // Feast uses table photos and the exact tasting record, never a later memory.
 await run(`(()=>{const meal=state.meals[0];meal.photos=['pizza','salad'];meal.note='一起吃饭的回忆。'.repeat(160);const record=state.records.find(r=>r.mealId===meal.id);record.note='这顿饭当次的味道';record.photos=['rice','noodles'];FoodBooks.select('feasts');})()`);
 assert.match(await run(`document.querySelector('.cover-book-name').textContent`),/欢聚一堂/);await capture('三本书-盛宴封面.png');
 await click('[data-action="openBookAnimated"]');await ready('!bookBusy');
 const feast=await run(`(()=>{const pages=FoodBooks.pages,meal=state.meals[0];const mine=pages.filter(p=>p.id===meal.id);const sheets=mine.flatMap(p=>[p.left,p.right]);return {blocks:sheets.flatMap(s=>s.blocks||[]).map(b=>b.text||'').join('\\n'),photos:sheets.filter(s=>s.hero).map(s=>s.src)}})()`);
 assert.match(feast.blocks,/这顿饭当次的味道/);assert.ok(feast.photos.includes('rice')&&feast.photos.includes('noodles')&&feast.photos.includes('pizza')&&feast.photos.includes('salad'));
 await capture('三本书-盛宴总览.png');await checkFit();
 await run(`catalog()`);assert.ok(await run(`document.querySelectorAll('.book-catalog-entry').length`)>0);await click('[data-action="chapterJump"]');
 await run(`FoodBooks.select('recipes')`);await click('[data-action="bookFullscreen"]');await ready(`document.body.classList.contains('book-fullscreen')`);await pause(250);await checkFit();await capture('三本书-全屏食谱续页.png');
 await run(`document.querySelector('[data-action="bookFullscreen"]').click()`);await ready(`!document.body.classList.contains('book-fullscreen')`);await pause(200);
 win.setContentSize(900,650);await pause(250);await checkFit();win.setContentSize(1380,940);await pause(250);
 // Photo storage, portable backup validation and reload are all part of the feature.
 await run(`save();exportBackup()`);assert.ok(fs.existsSync(backup));const exported=JSON.parse(fs.readFileSync(backup,'utf8'));assert.equal(exported.data.recipes.length,1);assert.match(exported.data.recipes[0].cover,/^data:image/);assert.match(exported.data.recipes[0].steps[1].photos[0],/^data:image/);
 assert.equal(await run(`validBackup(${JSON.stringify(exported)})`),true);
 const corrupt=structuredClone(exported);corrupt.data.recipes[0].steps[0].photos=['https://invalid/image'];assert.equal(await run(`validBackup(${JSON.stringify(corrupt)})`),false);
 const disk=JSON.parse(fs.readFileSync(path.join(profile,'菜单资料.json'),'utf8'));assert.equal(disk.recipes[0].cover,'dumplings');assert.match(disk.recipes[0].steps[1].photos[0],/^local:/);
 const reload=new Promise(r=>win.webContents.once('did-finish-load',r));win.webContents.reload();await reload;await ready(`typeof FoodBooks!=='undefined'`);assert.equal(await run('state.recipes[0].name'),'我的独家做法');
 await run(`FoodBooks.select('recipes');bookCover=false;render()`);await click('[data-action="deleteRecipe"]');await click('[data-action="confirmRecipeDelete"]');assert.equal(await run('state.recipes.length'),0);assert.ok(await run('state.dishes.length')>0);await click('[data-action="undoRecipeDelete"]');assert.equal(await run('state.recipes.length'),1);
 assert.deepEqual(errors,[]);console.log('PASS: 3-book navigation/covers; recipe create/edit/link/copy/steps/images/paste; independent dish data; complete adaptive pagination; feast table and exact tasting photos/notes; catalog; fullscreen; native photo storage; portable validation/export; reload; delete/undo');app.exit(0);
}catch(e){console.error(e.stack||e);app.exit(1)}});
