const {app,BrowserWindow}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const project=path.resolve(__dirname,'..');
const profile=fs.mkdtempSync(path.join(project,'work/cover-opening-'));
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
  const run=s=>win.webContents.executeJavaScript(s,true);
  const ready=async predicate=>{for(let i=0;i<60;i++){if(await run(predicate))return;await pause(30)}throw Error('Timed out: '+predicate)};
  const open=async()=>{await run(`setView('menu');state.bookIndex=3;setView('book')`);await pause(400);await run(`document.querySelector('[data-action="openBookAnimated"]').click()`);await ready(`!!document.querySelector('.book-cover-turner')`)};
  const animations=`document.getAnimations().filter(a=>a.id.startsWith('xstx-cover-'))`;
  const capture=async name=>{await pause(50);await win.webContents.capturePage();fs.writeFileSync(path.join(images,name),(await win.webContents.capturePage()).toPNG())};
  const errors=[];win.webContents.on('console-message',(_event,_level,msg)=>{if(/Uncaught|TypeError|ReferenceError/.test(msg))errors.push(msg)});
  win.webContents.debugger.attach('1.3');
  await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  await open();assert.equal(await run('bookBusy'),true);
  assert.equal(await run(`document.querySelector('#bookSpread').inert`),true,'Content cannot be clicked while concealed');
  await run(`${animations}.forEach(a=>a.pause())`);
  assert.equal(await run(`${animations}.length`),5);
  for(const time of [100,400,700,1000]){
   await run(`${animations}.forEach(a=>a.currentTime=${time})`);
   assert.equal(await run(`Number(getComputedStyle(document.getElementById('bookSpread')).opacity)`),0,'First page stays concealed until the cover fully rotates');
   if(time===400||time===700)await capture(`封面展开-${time}-内页隐藏.png`);
  }
  await run(`${animations}.forEach(a=>a.currentTime=1150)`);
  assert.ok(await run(`Number(getComputedStyle(document.getElementById('bookSpread')).opacity)`)>0);
  assert.ok(await run(`Number(getComputedStyle(document.getElementById('bookSpread')).opacity)`)<1);
  const matrix=await run(`(()=>{const m=new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.book-cover-turner')).transform);return {x:m.m11,z:m.m13}})()`);
  assert.ok(Math.abs(matrix.x+1)<.001&&Math.abs(matrix.z)<.001,'Cover has completed 180 degrees before content begins to appear');
  await capture('封面展开完成-内页柔和显现.png');
  await run(`${animations}.forEach(a=>a.finish())`);await ready('!bookBusy');
  assert.equal(await run('state.bookIndex'),0);assert.equal(await run(`document.querySelector('#bookSpread h2').textContent`),'鲜肉小笼包');
  assert.equal(await run(`document.querySelector('#bookSpread').inert`),false);
  assert.equal(await run(`getComputedStyle(document.getElementById('bookSpread')).opacity`),'1');
  assert.equal(await run(`document.querySelectorAll('.book-opening-paper,.book-cover-turner').length`),0);
  assert.equal(JSON.parse(fs.readFileSync(path.join(profile,'菜单资料.json'),'utf8')).bookIndex,0);
  await capture('封面展开完成-第一页.png');
  // Navigation, page rebuilds and resize cannot leave old covers or locked controls.
  await open();await run(`setView('menu');setView('book')`);await ready('!bookBusy');
  assert.equal(await run(`document.querySelectorAll('.book-opening-paper,.book-cover-turner').length`),0);
  assert.equal(await run('bookCover'),true);
  await open();await run(`render()`);await ready('!bookBusy');
  assert.equal(await run(`document.querySelectorAll('.book-opening-paper,.book-cover-turner').length`),0);
  await open();await run(`window.dispatchEvent(new Event('resize'))`);await ready('!bookBusy');
  assert.equal(await run(`document.querySelector('[data-action="toggleBookCover"]').disabled`),false);
  await open();await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await ready('!bookBusy');
  assert.equal(await run(`document.querySelectorAll('.book-opening-paper,.book-cover-turner').length`),0);
  await run(`setView('menu');setView('book');document.querySelector('[data-action="openBookAnimated"]').click()`);
  assert.equal(await run('bookBusy'),false);assert.equal(await run('state.bookIndex'),0);
  win.webContents.debugger.detach();assert.deepEqual(errors,[]);
  console.log('PASS: first-page photo/text concealed throughout cover rotation; blank paper base; full 180-degree turn before soft content reveal; inert controls; landing on first page; persisted page; navigation/re-render/resize cancellation; reduced motion');
  app.exit(0);
 }catch(error){console.error(error.stack||error);app.exit(1)}
});
