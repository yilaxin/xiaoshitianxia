const {app,BrowserWindow}=require('electron'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),profile=fs.mkdtempSync(path.join(root,'work/resource-lifecycle-'));
process.env.XSTX_HEADLESS_TEST='1';process.argv.push('--data-dir='+profile);require(path.join(root,process.env.XSTX_TEST_BUILD||'dist-app','main.cjs'));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
app.whenReady().then(async()=>{try{
 const win=BrowserWindow.getAllWindows()[0];await new Promise(r=>win.webContents.once('did-finish-load',r));
 const run=s=>win.webContents.executeJavaScript(s,true),errors=[];win.webContents.on('console-message',e=>{if(/Uncaught|TypeError|ReferenceError/.test(e.message))errors.push(e.message)});
 assert.ok(fs.existsSync(path.join(profile,'菜单资料.json')),'First launch initializes saved data');
 const fixture=fs.readFileSync(path.join(root,'assets/rice.jpg')).toString('base64');
 await run(`(()=>{const next=structuredClone(state);next.dishes[0].cover='data:image/jpeg;base64,${fixture}';next.records[0].photos=[next.dishes[0].cover];commit(next);render()})()`);
 assert.match(await run('state.dishes[0].cover'),/^local:/);assert.ok(await run('JSON.stringify(state).length')<20000);
 const decoded=await run(`(async()=>{const photo=new Image();photo.crossOrigin='anonymous';photo.src=img(state.dishes[0].cover);await photo.decode();const c=document.createElement('canvas');c.width=c.height=1;c.getContext('2d').drawImage(photo,0,0,1,1);return {width:photo.naturalWidth,pixel:c.toDataURL()};})()`);
 assert.ok(decoded.width>100);assert.match(decoded.pixel,/^data:image\/png/,'Local photo can be drawn into an untainted canvas');
 assert.equal(await run(`(async()=>{const response=await fetch('xstx-media://photos/not-a-hash.jpg');return response.status})()`),404);
 for(let i=0;i<8;i++){
  await run(`openDish(state.dishes[0].id);document.getElementById('detailDialog').close();openForm();document.getElementById('formDialog').close();FoodBooks.openRecipe();document.getElementById('recipeDialog').close()`);await wait(350);
  assert.equal(await run(`document.querySelectorAll('dialog:not([open]) img,dialog:not([open]) input,dialog:not([open]) textarea').length`),0,await run("[...document.querySelectorAll('dialog')].map(d=>({id:d.id,open:d.open,children:d.children.length}))"));
  assert.equal(await run('formDraft'),null);
 }
 await run(`FoodBooks.openRecipe();document.getElementById('recipeDialog').close();FoodBooks.openRecipe();document.getElementById('recipeName').value='快速重开后的食谱'`);await wait(50);
 await run(`document.querySelector('#recipeForm').requestSubmit()`);await wait(80);
 assert.equal(await run('state.recipes[0].name'),'快速重开后的食谱','A late close event cannot discard a reopened editor draft');
 await run(`setView('menu');openForm();document.getElementById('formDialog').close();openForm();document.getElementById('dishName').value='快速重开后的美味'`);await wait(50);
 assert.equal(await run('formDraft!==null'),true);assert.equal(await run(`document.getElementById('dishName').value`),'快速重开后的美味');await run(`document.getElementById('formDialog').close()`);await wait(30);
 const panorama=await run(`(async()=>{const c=document.createElement('canvas');c.width=5000;c.height=1;const blob=await new Promise(r=>c.toBlob(r,'image/png'));const [data]=await filesToPhotos([new File([blob],'panorama.png',{type:'image/png'})]);const photo=new Image();photo.src=data;await photo.decode();return {w:photo.naturalWidth,h:photo.naturalHeight};})()`);
 assert.deepEqual(panorama,{w:1000,h:1},'Extreme aspect ratios still produce a real photo');
 await run(`FoodBooks.select('recipes');bookCover=false;render();document.querySelector('[data-action="deleteRecipe"]').click();document.querySelector('[data-action="confirmRecipeDelete"]').click()`);await wait(50);
 await run(`(()=>{restoreState(seed());render();const button=document.createElement('button');button.dataset.action='undoRecipeDelete';document.body.append(button);button.click();button.remove()})()`);
 assert.equal(await run('(state.recipes||[]).length'),0,'Restoring another library clears stale recipe undo');
 await run(`state.dayNotes={'2026-10-16':{title:'旧随记',body:'不应混入恢复后的资料',updated:TODAY}};save();setView('calendar');year=2026;month=9;selectedDate='2026-10-16';render();document.querySelector('[data-action="calendarWriteNote"]').click();document.querySelector('[data-action="calendarDeleteNote"]').click();document.querySelector('[data-action="calendarConfirmNote"]').click()`);await wait(50);
 await run(`(()=>{restoreState(seed());render();const button=document.createElement('button');button.dataset.action='calendarUndoNote';document.body.append(button);button.click();button.remove()})()`);
 assert.equal(await run('Object.keys(state.dayNotes||{}).length'),0,'Restoring another library clears stale journal undo');
 assert.equal(await run(`(()=>{const data=seed();data.records[0].date='2026-02-30';return validBackup({app:'笑食天下',format:'prototype-1',data})})()`),false);
 assert.deepEqual(errors,[]);console.log('PASS: first-run persistence; compact saved/reloaded photos; actual protocol/CORS/canvas; invalid photo path; repeated dialog resource release; immediate reopen drafts; extreme panorama; restored library cannot receive stale recipe/journal undo; strict backup dates');app.exit(0);
}catch(e){console.error(e.stack||e);app.exit(1)}});
