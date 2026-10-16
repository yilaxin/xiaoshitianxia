const {app,BrowserWindow}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const project=path.resolve(__dirname,'..');
const profile=fs.mkdtempSync(path.join(project,'work/category-sort-'));
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
  const draft=()=>run(`[...document.querySelectorAll('#categoryRows .manage-item input:not([type=hidden])')].map(input=>input.value)`);
  const capture=async name=>{await pause(100);fs.writeFileSync(path.join(images,name),(await win.webContents.capturePage()).toPNG())};
  const click=selector=>run(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const close=async()=>{await click('#auxDialog [data-action="close"]');await pause(40)};
  const open=async()=>{await run('manageCategories()');await pause(250)};
  const drag=async(sourceIndex,targetIndex,captureName)=>{
   const points=await run(`(()=>{const rows=[...document.querySelectorAll('#categoryRows .manage-item')];const a=rows[${sourceIndex}].querySelector('.category-sort-handle').getBoundingClientRect();const b=rows[${targetIndex}].getBoundingClientRect();return {x:Math.round(a.x+a.width/2),start:Math.round(a.y+a.height/2),end:Math.round(${sourceIndex}<${targetIndex}?b.bottom-5:b.top+5)}})()`);
   win.webContents.sendInputEvent({type:'mouseMove',x:points.x,y:points.start});
   win.webContents.sendInputEvent({type:'mouseDown',button:'left',x:points.x,y:points.start,clickCount:1});
   for(let i=1;i<=12;i++){
    win.webContents.sendInputEvent({type:'mouseMove',x:points.x,y:Math.round(points.start+(points.end-points.start)*i/12),modifiers:['leftButtonDown']});await pause(15);
   }
   assert.equal(await run(`!!document.querySelector('.category-sort-dragging')`),true,'Actual pointer movement must activate sorting');
   if(captureName)await capture(captureName);
   win.webContents.sendInputEvent({type:'mouseUp',button:'left',x:points.x,y:points.end,clickCount:1});await pause(180);
  };
  await pause(500);
  const original=await run('structuredClone(state.categories)');
  await open();assert.equal(await run(`document.querySelectorAll('.category-sort-handle').length`),original.length);
  await capture('分类管理-拖动手柄.png');
  await drag(0,2,'分类管理-拖动中.png');
  assert.deepEqual(await draft(),[original[1],original[2],original[0],...original.slice(3)]);
  assert.deepEqual(await run('state.categories'),original,'A draft reorder must not save before confirmation');
  await close();await open();assert.deepEqual(await draft(),original,'Cancel must discard a reorder');

  // Keyboard ordering also keeps the original-name mapping used to rename dishes.
  await run(`document.querySelector('.category-sort-handle').focus()`);
  win.webContents.sendInputEvent({type:'keyDown',keyCode:'End'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'End'});await pause(170);
  assert.deepEqual(await draft(),[...original.slice(1),original[0]]);
  await click('#auxDialog [data-action="newCatRow"]');await pause(30);
  assert.equal(await run(`document.querySelectorAll('.category-sort-handle').length`),original.length+1);
  await run(`document.querySelectorAll('#categoryRows .manage-item input:not([type=hidden])')[${original.length}].value='水果'`);
  await drag(original.length,0);
  assert.equal((await draft())[0],'水果');
  await run(`(()=>{const row=[...document.querySelectorAll('#categoryRows .manage-item')].find(row=>row.querySelector('input[type=hidden]').value==='素菜');row.querySelector('input:not([type=hidden])').value='蔬菜';row.querySelector('input:not([type=hidden])').dispatchEvent(new Event('input',{bubbles:true}));const other=[...document.querySelectorAll('#categoryRows .manage-item')].find(row=>row.querySelector('input[type=hidden]').value==='其他');other.querySelector('[data-action="removeCatRow"]').click()})()`);
  const expected=await draft();
  const beforeDisk=fs.readFileSync(path.join(profile,'菜单资料.json'),'utf8');
  await run(`document.querySelectorAll('#categoryRows .manage-item input:not([type=hidden])')[1].value='水果';document.getElementById('categoryForm').requestSubmit()`);
  assert.equal(await run(`document.getElementById('auxDialog').open`),true);
  assert.match(await run(`document.getElementById('catError').textContent`),/重复/);
  assert.equal(fs.readFileSync(path.join(profile,'菜单资料.json'),'utf8'),beforeDisk);
  await run(`document.querySelectorAll('#categoryRows .manage-item input:not([type=hidden])')[1].value=${JSON.stringify(expected[1])};document.getElementById('categoryForm').requestSubmit()`);
  assert.deepEqual(await run('state.categories'),expected);
  assert.equal(await run(`state.dishes.filter(d=>d.category==='蔬菜').length`),3);
  assert.deepEqual(await run(`[...document.querySelectorAll('#filters .chip')].map(button=>button.dataset.category)`),['全部',...expected]);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(profile,'菜单资料.json'),'utf8')).categories,expected);
  await run(`setView('book')`);
  assert.deepEqual(await run(`[...document.querySelectorAll('#bookCategory option')].map(option=>option.textContent)`),['全部','特别喜欢',...expected]);
  await run(`openForm()`);
  assert.deepEqual(await run(`[...document.querySelectorAll('#dishCategory option')].map(option=>option.textContent)`),['未分类',...expected]);
  await click('#formDialog [data-action="close"]');
  const reloaded=new Promise(resolve=>win.webContents.once('did-finish-load',resolve));win.webContents.reload();await reloaded;
  assert.deepEqual(await run('state.categories'),expected,'Order must survive restart');

  await open();
  const first=await run(`(()=>{const r=document.querySelector('.category-sort-handle').getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()`);
  win.webContents.sendInputEvent({type:'mouseDown',button:'left',x:first.x,y:first.y,clickCount:1});
  win.webContents.sendInputEvent({type:'mouseMove',x:first.x,y:first.y+130,modifiers:['leftButtonDown']});await pause(80);
  win.webContents.sendInputEvent({type:'keyDown',keyCode:'Escape'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'Escape'});
  win.webContents.sendInputEvent({type:'mouseUp',button:'left',x:first.x,y:first.y+130,clickCount:1});await pause(80);
  assert.equal(await run(`document.getElementById('auxDialog').open`),true,'Escape during drag cancels the gesture, not the entire dialog');
  assert.deepEqual(await draft(),expected);
  await close();

  // Long lists scroll while the handle is held near the dialog edge.
  await run(`state.categories=[...state.categories,...Array.from({length:18},(_,i)=>'分类'+i)]`);await open();
  const long=await run(`(()=>{const d=document.getElementById('auxDialog');d.scrollTop=0;const r=document.querySelector('.category-sort-handle').getBoundingClientRect();const b=d.getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2),bottom:Math.round(b.bottom-12)}})()`);
  win.webContents.sendInputEvent({type:'mouseDown',button:'left',x:long.x,y:long.y,clickCount:1});
  win.webContents.sendInputEvent({type:'mouseMove',x:long.x,y:long.bottom,modifiers:['leftButtonDown']});await pause(750);
  assert.ok(await run(`document.getElementById('auxDialog').scrollTop`)>0,'Dragging at the edge must scroll long category lists');
  win.webContents.sendInputEvent({type:'mouseUp',button:'left',x:long.x,y:long.bottom,clickCount:1});await pause(30);
  await close();
  console.log('PASS: real pointer drag; draft/cancel; keyboard ordering; new categories; rename/delete mappings; duplicate rejection; menu/book/form order; persisted restart; Escape recovery; edge autoscroll');
  app.exit(0);
 }catch(error){console.error(error.stack||error);app.exit(1)}
});
