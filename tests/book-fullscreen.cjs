const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const project=path.resolve(__dirname,'..');
const profile=fs.mkdtempSync(path.join(project,'work/book-fullscreen-'));
const images=path.join(project,'outputs/v'+require('../package.json').version);fs.mkdirSync(images,{recursive:true});
process.env.XSTX_HEADLESS_TEST='1';process.argv.push('--data-dir='+profile);
require('../dist-app/main.cjs');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
app.whenReady().then(async()=>{
 try{
  const win=BrowserWindow.getAllWindows()[0];
  await new Promise((resolve,reject)=>{win.webContents.once('did-finish-load',resolve);win.webContents.once('did-fail-load',(_e,c,d)=>reject(Error(c+': '+d)))});
  const run=s=>win.webContents.executeJavaScript(s,true);
  const ready=async s=>{for(let i=0;i<100;i++){if(await run(s))return;await pause(40)}throw Error('Timed out: '+s)};
  const click=selector=>run(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const key=async keyCode=>{win.webContents.sendInputEvent({type:'keyDown',keyCode});win.webContents.sendInputEvent({type:'keyUp',keyCode});await pause(70)};
  const isFull=()=>run(`window.desktop.isFullscreen()&&document.body.classList.contains('book-fullscreen')`);
  const normal=async()=>{await ready(`!window.desktop.isFullscreen()&&!document.body.classList.contains('book-fullscreen')`);await pause(150)};
  const capture=async name=>{
   await run(`Promise.all([...document.images].map(image=>image.decode().catch(()=>{})))`);
   for(let attempt=0;attempt<3;attempt++){
    await pause(300);
    try{const image=await win.webContents.capturePage();fs.writeFileSync(path.join(images,name),image.toPNG());return;}
    catch(error){if(attempt===2||!String(error.message).includes('UnknownVizError'))throw error;}
   }
  };
  const fit=async()=>{
   const boxes=await run(`(()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height}};return {height:innerHeight,width:innerWidth,stage:rect('.book-stage'),nav:rect('.book-nav'),toolbar:rect('.book-toolbar'),book:document.querySelector('#bookSpread')?rect('#bookSpread'):rect('.book-cover')}})()`);
   for(const name of ['toolbar','stage','nav','book']){assert.ok(boxes[name].top>=-1&&boxes[name].bottom<=boxes.height+1,name+' fits vertically');assert.ok(boxes[name].left>=-1&&boxes[name].right<=boxes.width+1,name+' fits horizontally')}
  };
  const errors=[];win.webContents.on('console-message',(_event,_level,msg)=>{if(/Uncaught|TypeError|ReferenceError/.test(msg))errors.push(msg)});
  win.webContents.debugger.attach('1.3');
  await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  await run(`setView('book')`);await pause(400);
  assert.equal(await run(`!!document.querySelector('[data-action="bookFullscreen"]')`),true);
  const bounds=win.getBounds();
  await click('[data-action="bookFullscreen"]');await ready(`window.desktop.isFullscreen()`);assert.equal(await isFull(),true);
  assert.equal(win.isFullScreen(),true,'Renderer button must enter real native fullscreen');
  await fit();assert.equal(await run(`getComputedStyle(document.querySelector('.sidebar')).display`),'none');
  assert.equal(await run(`document.querySelector('[data-action="bookFullscreen"]').textContent`),'退出全屏');
  await capture('全屏翻阅-封面.png');
  await click('[data-action="openBookAnimated"]');await ready('!bookBusy');
  assert.equal(await run('state.bookIndex'),0);await fit();await capture('全屏翻阅-书页.png');
  const before=await run(`(()=>{const r=document.getElementById('bookSpread').getBoundingClientRect();return {height:r.height,top:r.top}})()`);
  await run(`document.activeElement.blur()`);await key('Right');await ready('!bookBusy&&state.bookIndex===1');
  assert.equal(await isFull(),true);await fit();
  const after=await run(`(()=>{const r=document.getElementById('bookSpread').getBoundingClientRect();return {height:r.height,top:r.top}})()`);assert.deepEqual(after,before,'Fullscreen page turns retain stable geometry');
  await key('Escape');await normal();assert.equal(await run('state.bookIndex'),1,'Exiting retains the current dish');
  assert.equal(await run(`getComputedStyle(document.querySelector('.sidebar')).display`),'flex');
  assert.equal(win.getBounds().width,bounds.width);assert.equal(win.getBounds().height,bounds.height);
  await run(`document.activeElement.blur()`);await key('F11');await ready(`window.desktop.isFullscreen()`);await key('F11');await normal();
  // Detail dialogs consume their first Escape without unexpectedly leaving reading mode.
  await click('[data-action="bookFullscreen"]');await ready(`window.desktop.isFullscreen()`);
  await run(`openDish(bookDishes()[state.bookIndex].id)`);await key('Escape');await ready(`!document.getElementById('detailDialog').open`);
  assert.equal(await isFull(),true);await key('Escape');await normal();
  // Leaving the reading page always restores the regular app layout.
  await click('[data-action="bookFullscreen"]');await ready(`window.desktop.isFullscreen()`);await run(`setView('menu')`);await normal();
  assert.equal(await run('view'),'menu');assert.equal(await run(`document.querySelectorAll('[data-action="bookFullscreen"]').length`),0);
  // At the smallest supported window, controls still remain on screen.
  win.setContentSize(900,650);await pause(100);await run(`setView('book');bookCover=false;render()`);
  await click('[data-action="bookFullscreen"]');await ready(`window.desktop.isFullscreen()`);await fit();
  await run(`void flipBook(1)`);await ready(`!!document.querySelector('.paper-leaf')`);
  await key('Escape');await normal();await ready('!bookBusy');
  assert.equal(await run(`document.querySelectorAll('.paper-leaf').length`),0,'Exit during a turn settles the selected page');
  // Quick enter/exit requests cannot strand the native window or its layout.
  await run(`for(let i=0;i<4;i++)document.querySelector('[data-action="bookFullscreen"]').click()`);await normal();
  await click('[data-action="bookFullscreen"]');await ready(`window.desktop.isFullscreen()`);
  const reloaded=new Promise(resolve=>win.webContents.once('did-finish-load',resolve));win.webContents.reload();await reloaded;await normal();
  assert.equal(await run('view'),'menu');
  win.webContents.debugger.detach();assert.deepEqual(errors,[]);
  console.log('PASS: native fullscreen IPC/button; fitted cover/book/toolbar/navigation; keyboard page turns; stable geometry; Escape/F11 and window bounds; page retained; dialog Escape; navigation auto-exit; small window; interrupted turn; fast toggles; reload recovery');
  app.exit(0);
 }catch(error){console.error(error.stack||error);app.exit(1)}
});
