const {app,BrowserWindow}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const project=path.resolve(__dirname,'..');
const profile=fs.mkdtempSync(path.join(project,'work/tag-sort-'));
const images=path.join(project,'outputs/v'+require('../package.json').version);
fs.mkdirSync(images,{recursive:true});
process.env.XSTX_HEADLESS_TEST='1';
process.argv.push('--data-dir='+profile);
require('../dist-app/main.cjs');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
app.whenReady().then(async()=>{
 try{
  const win=BrowserWindow.getAllWindows()[0];
  await new Promise((resolve,reject)=>{win.webContents.once('did-finish-load',resolve);win.webContents.once('did-fail-load',(_e,code,desc)=>reject(Error(code+': '+desc)))});
  const run=script=>win.webContents.executeJavaScript(script,true);
  const draft=()=>run(`[...document.querySelectorAll('#tagRows [data-old]')].map(input=>input.value)`);
  const click=selector=>run(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const close=()=>click('#auxDialog [data-action="close"]');
  const open=async()=>{await run('manageTags()');await pause(250)};
  const capture=async name=>{await pause(250);await win.webContents.capturePage();fs.writeFileSync(path.join(images,name),(await win.webContents.capturePage()).toPNG())};
  const reload=async()=>{const done=new Promise(resolve=>win.webContents.once('did-finish-load',resolve));win.webContents.reload();await done;await pause(300)};
  const key=async keyCode=>{win.webContents.sendInputEvent({type:'keyDown',keyCode});win.webContents.sendInputEvent({type:'keyUp',keyCode});await pause(170)};
  const drag=async(source,target,captureName)=>{
   const pt=await run(`(()=>{const r=[...document.querySelectorAll('#tagRows .manage-item')];r[${source}].scrollIntoView({block:'nearest'});const a=r[${source}].querySelector('.category-sort-handle').getBoundingClientRect(),b=r[${target}].getBoundingClientRect();return {x:Math.round(a.x+a.width/2),start:Math.round(a.y+a.height/2),end:Math.round(${source}<${target}?b.bottom-5:b.top+5)}})()`);
   win.webContents.sendInputEvent({type:'mouseMove',x:pt.x,y:pt.start});
   win.webContents.sendInputEvent({type:'mouseDown',button:'left',x:pt.x,y:pt.start,clickCount:1});
   for(let i=1;i<=12;i++){win.webContents.sendInputEvent({type:'mouseMove',x:pt.x,y:Math.round(pt.start+(pt.end-pt.start)*i/12),modifiers:['leftButtonDown']});await pause(15)}
   assert.equal(await run(`!!document.querySelector('#tagRows .category-sort-dragging')`),true);
   if(captureName)await capture(captureName);
   win.webContents.sendInputEvent({type:'mouseUp',button:'left',x:pt.x,y:pt.end,clickCount:1});await pause(180);
  };
  await pause(400);
  const original=await run('orderedTags()');
  const originalData=await run('structuredClone(state)');
  await run(`setView('settings')`);await open();
  assert.equal(await run(`document.querySelectorAll('#tagRows .category-sort-handle').length`),original.length);
  await capture('标签管理-换序手柄.png');
  await drag(0,2,'标签管理-拖动中.png');
  assert.deepEqual(await draft(),[original[1],original[2],original[0],...original.slice(3)]);
  assert.deepEqual(await run('state'),originalData,'Drag is only a draft');
  await close();await open();assert.deepEqual(await draft(),original,'Cancel discards draft order');
  await run(`document.querySelector('#tagRows .category-sort-handle').focus()`);await key('End');
  assert.deepEqual(await draft(),[...original.slice(1),original[0]]);
  // Reordering must not break the original-name mapping for rename/remove/merge.
  await run(`(()=>{const inputs=[...document.querySelectorAll('#tagRows [data-old]')];inputs.find(i=>i.dataset.old==='早餐').value='早饭';inputs.find(i=>i.dataset.old==='暖胃').value='家常';inputs.find(i=>i.dataset.old==='日式').closest('.manage-item').querySelector('[data-action="removeCatRow"]').click()})()`);
  const expected=[...new Set(await draft())];
  const before=fs.readFileSync(path.join(profile,'菜单资料.json'),'utf8');
  await run(`document.querySelector('#tagRows [data-old]').value=' ';document.getElementById('tagsForm').requestSubmit()`);
  assert.match(await run(`document.getElementById('tagsError').textContent`),/不能为空/);
  assert.equal(fs.readFileSync(path.join(profile,'菜单资料.json'),'utf8'),before);
  await run(`document.querySelector('#tagRows [data-old]').value='早饭';document.getElementById('tagsForm').requestSubmit()`);
  assert.deepEqual(await run('state.tagOrder'),expected);
  assert.equal(await run(`state.dishes.some(d=>d.tags.includes('早餐')||d.tags.includes('暖胃')||d.tags.includes('日式'))`),false);
  assert.equal(await run(`state.dishes.filter(d=>d.tags.includes('早饭')).length`),2);
  assert.equal(await run(`state.dishes.filter(d=>d.tags.includes('家常')).length`),2);
  assert.equal(await run(`state.dishes.every(d=>new Set(d.tags).size===d.tags.length)`),true);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(profile,'菜单资料.json'),'utf8')).tagOrder,expected);
  await reload();await open();assert.deepEqual(await draft(),expected,'Order survives restart');await close();
  // New tags append; renamed tags and a portable backup keep their position.
  await run(`(()=>{const next=structuredClone(state);next.dishes[0].tags.push('新口味');commit(next)})()`);
  await open();assert.deepEqual(await draft(),[...expected,'新口味']);
  await run(`document.getElementById('tagsForm').requestSubmit()`);
  const finalOrder=[...expected,'新口味'];
  const {Storage}=require('../dist-app/storage.cjs');
  const store=new Storage(profile);
  const backup=store.portable(JSON.parse(fs.readFileSync(store.file,'utf8')));
  assert.equal(await run(`validBackup(${JSON.stringify(backup)})`),true);
  const restored=new Storage(fs.mkdtempSync(path.join(project,'work/tag-restore-')));
  restored.save(backup.data);assert.deepEqual(restored.load().tagOrder,finalOrder);
  await open();await drag(0,2);
  // Escape during an active pointer drag restores the order without closing the dialog.
  const pt=await run(`(()=>{document.getElementById('auxDialog').scrollTop=0;const b=document.querySelector('#tagRows .category-sort-handle').getBoundingClientRect();return {x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height/2)}})()`);
  const cancelExpected=await draft();
  win.webContents.sendInputEvent({type:'mouseDown',button:'left',x:pt.x,y:pt.y,clickCount:1});
  win.webContents.sendInputEvent({type:'mouseMove',x:pt.x,y:pt.y+100,modifiers:['leftButtonDown']});await pause(60);await key('Escape');
  win.webContents.sendInputEvent({type:'mouseUp',button:'left',x:pt.x,y:pt.y+100,clickCount:1});
  assert.equal(await run(`document.getElementById('auxDialog').open`),true);assert.deepEqual(await draft(),cancelExpected);await close();
  // Shared sorting code still scopes keyboard input to the open category dialog.
  await run('manageCategories()');await pause(200);
  await run(`document.querySelector('#categoryRows .category-sort-handle').focus()`);await key('Down');
  assert.deepEqual(await run(`[...document.querySelectorAll('#categoryRows input:not([type=hidden])')].map(i=>i.value).slice(0,2)`),['素菜','荤菜']);await close();
  await run(`(()=>{const next=structuredClone(state);next.dishes.forEach(d=>d.tags=[]);commit(next)})()`);await open();
  assert.equal(await run(`document.querySelectorAll('#tagRows .category-sort-handle').length`),0);
  assert.match(await run(`document.getElementById('tagRows').textContent`),/还没有标签/);
  await run(`document.getElementById('tagsForm').requestSubmit()`);assert.deepEqual(await run('state.tagOrder'),[]);
  console.log('PASS: real tag handle drag; cancel; keyboard to last; rename/remove/merge mappings; validation preserves data; saved order reload; new tags append; portable backup/restore; Escape recovery; category/tag isolation; empty tags');
  app.exit(0);
 }catch(error){console.error(error.stack||error);app.exit(1)}
});
