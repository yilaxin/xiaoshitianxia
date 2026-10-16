const {app,BrowserWindow}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const project=path.resolve(__dirname,'..');
const profile=fs.mkdtempSync(path.join(project,'work/book-turn-'));
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
  const ready=async predicate=>{for(let i=0;i<40;i++){if(await run(predicate))return;await pause(30)}throw Error('Timed out: '+predicate)};
  const capture=async name=>{await pause(90);fs.writeFileSync(path.join(images,name),(await win.webContents.capturePage()).toPNG())};
  win.webContents.debugger.attach('1.3');
  const media=async value=>{await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value}]});await pause(80)};
  await media('no-preference');
  await run(`setView('book');bookCover=false;state.bookIndex=0;render()`);await pause(450);
  await run(`void flipBook(1)`);await ready(`!!document.querySelector('.paper-leaf')`);
  assert.equal(await run('bookBusy'),true);
  assert.equal(await run('state.bookIndex'),0,'Do not commit before the leaf lands');
  assert.equal(await run(`document.querySelector('.paper-front h2').textContent`),'鲜肉小笼包');
  assert.equal(await run(`document.querySelector('.paper-back img').alt`),'溏心蛋拉面','Reverse side must contain the next photo');
  assert.equal(await run(`document.querySelector('#bookSpread>.book-right h2').textContent`),'溏心蛋拉面','Upcoming page must be visible beneath the moving paper');
  assert.equal(await run(`document.querySelector('[data-action="nextBook"]').disabled`),true);
  await run(`for(let i=0;i<8;i++)void flipBook(1)`);
  assert.equal(await run(`document.querySelectorAll('.paper-leaf').length`),1,'Repeated input must not queue leaves');
  await run(`document.getAnimations().filter(a=>a.id.startsWith('xstx-paper-')).forEach(a=>a.pause())`);
  const frames=[];
  for(const time of [100,260,450,660,820]){
   await run(`document.getAnimations().filter(a=>a.id.startsWith('xstx-paper-')).forEach(a=>a.currentTime=${time})`);
   frames.push(await run(`({matrix:getComputedStyle(document.querySelector('.paper-leaf')).transform,light:getComputedStyle(document.querySelector('.paper-front .paper-light')).opacity,shadow:getComputedStyle(document.querySelector('.paper-cast-shadow')).opacity})`));
   await capture(`翻页-${time}.png`);
  }
  assert.notEqual(frames[0].matrix,frames[3].matrix,'Paper must physically rotate');
  assert.notEqual(frames[0].light,frames[2].light,'Paper lighting must change with angle');
  assert.notEqual(frames[0].shadow,frames[2].shadow,'Cast shadow must evolve');
  await run(`document.getAnimations().filter(a=>a.id.startsWith('xstx-paper-')).forEach(a=>a.play())`);
  await ready('!bookBusy');
  assert.equal(await run('state.bookIndex'),1);
  assert.equal(await run(`document.querySelectorAll('.paper-turn-space').length`),0);
  assert.equal(await run(`document.querySelector('#bookSpread>.book-right h2').textContent`),'溏心蛋拉面');
  assert.equal(JSON.parse(fs.readFileSync(path.join(profile,'菜单资料.json'),'utf8')).bookIndex,1);

  await run(`void flipBook(-1)`);await ready(`!!document.querySelector('.paper-leaf')`);
  assert.equal(await run(`!!document.querySelector('.turn-backward')`),true);
  assert.equal(await run(`document.querySelector('.paper-back h2').textContent`),'鲜肉小笼包');
  await pause(400);await capture('向前翻页.png');await ready('!bookBusy');
  assert.equal(await run('state.bookIndex'),0);
  await run(`void flipBook(-1)`);assert.equal(await run('bookBusy'),false,'First page must stop at its boundary');

  await run(`void flipBook(1)`);await ready(`!!document.querySelector('.paper-leaf')`);
  await run(`setView('menu');setView('book');bookCover=false;render()`);
  assert.equal(await run('bookBusy'),false);
  assert.equal(await run('state.bookIndex'),0,'Interrupted turns preserve the previous page');
  assert.equal(await run(`document.querySelectorAll('.paper-turn-space').length`),0);
  await run(`void flipBook(1)`);await ready(`!!document.querySelector('.paper-leaf')`);
  win.setContentSize(1050,900);await ready('!bookBusy');
  assert.equal(await run('state.bookIndex'),1,'Resize should settle the selected page');
  await run(`void flipBook(1)`);await ready(`!!document.querySelector('.paper-leaf')`);
  await media('reduce');await ready('!bookBusy');
  assert.equal(await run('state.bookIndex'),2,'Changing reduced-motion preference should finish the turn immediately');
  await run(`void flipBook(-1)`);
  assert.equal(await run('state.bookIndex'),1);
  assert.equal(await run('bookBusy'),false);
  assert.equal(await run(`document.querySelectorAll('.paper-turn-space').length`),0);
  await run(`state.bookIndex=bookDishes().length-1;render();void flipBook(1)`);
  assert.equal(await run('bookBusy'),false,'Last page must stop at its boundary');
  win.webContents.debugger.detach();
  console.log('PASS: two-sided paper; next/previous direction; angle-dependent light and shadow; persisted landing page; repeated input; boundaries; navigation interruption; resize; reduced motion');
  app.exit(0);
 }catch(error){console.error(error.stack||error);app.exit(1)}
});
