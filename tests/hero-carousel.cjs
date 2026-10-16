const {app,BrowserWindow}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const project=path.resolve(__dirname,'..');
const profile=fs.mkdtempSync(path.join(project,'work/hero-carousel-'));
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
  const click=selector=>run(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const capture=async name=>{await win.webContents.capturePage();fs.writeFileSync(path.join(images,name),(await win.webContents.capturePage()).toPNG())};
  const id=()=>run(`document.querySelector('.hero-image').dataset.id`);
  const failures=[];win.webContents.on('console-message',(_event,_level,msg)=>{if(/TypeError|ReferenceError|Uncaught/.test(msg))failures.push(msg)});
  await pause(400);
  await run(`window.heroClockStart=performance.now();setView('menu')`);
  const initial=await id();assert.ok(await run(`state.dishes.some(d=>d.id===${JSON.stringify(initial)})`));
  assert.equal(await run(`document.querySelector('.hero-caption b').textContent===dishBy(document.querySelector('.hero-image').dataset.id).name`),true);
  await capture('首页-随机美食封面.png');
  await pause(Math.max(0,4400-await run('performance.now()-heroClockStart')));assert.equal(await run(`document.querySelectorAll('.hero-slide').length`),1,'No switch before five seconds');
  await pause(Math.max(0,5200-await run('performance.now()-heroClockStart')));
  assert.equal(await run(`document.querySelectorAll('.hero-slide').length`),2,'Next image starts blending at five seconds');
  assert.ok(await run(`performance.now()-heroClockStart`)<6000);
  const next=await run(`document.querySelector('.hero-slide-incoming').dataset.dishId`);assert.notEqual(next,initial);
  assert.ok(await run(`Number(getComputedStyle(document.querySelector('.hero-slide-incoming')).opacity)`)>0);
  await run(`document.getAnimations().filter(a=>a.id==='xstx-hero-crossfade').forEach(a=>{a.pause();a.currentTime=400})`);
  await capture('首页-柔和切换中.png');
  // Clicking on either half of a transition opens the visually dominant dish.
  for(const [time,expected] of [[80,initial],[780,next]]){
   await run(`document.getAnimations().filter(a=>a.id==='xstx-hero-crossfade').forEach(a=>a.currentTime=${time})`);
   await click('.hero-image');assert.equal(await run('detailId'),expected);
   assert.equal(await run(`document.getElementById('detailDialog').open`),true);
   await click('#detailDialog [data-action="close"]');await pause(20);
   await run(`document.getAnimations().filter(a=>a.id==='xstx-hero-crossfade').forEach(a=>a.pause())`);
  }
  await run(`document.getAnimations().filter(a=>a.id==='xstx-hero-crossfade').forEach(a=>a.finish())`);await pause(50);
  assert.equal(await id(),next);assert.equal(await run(`document.querySelectorAll('.hero-slide').length`),1);
  const retained=await id();await run(`render()`);assert.equal(await id(),retained,'Ordinary re-render retains the current cover');

  // Control just the long carousel timeouts to test full shuffle rounds without waiting a minute.
  await run(`window.heroTimers=new Map();window.heroTimerId=-1;window.nativeTimeout=window.setTimeout;window.nativeClearTimeout=window.clearTimeout;window.setTimeout=(fn,delay,...args)=>{if(delay>=3900&&delay<=5000){const id=heroTimerId--;heroTimers.set(id,{fn,delay,args});return id}return nativeTimeout(fn,delay,...args)};window.clearTimeout=id=>{if(heroTimers.has(id))heroTimers.delete(id);else nativeClearTimeout(id)};void 0;`);
  const tick=async()=>{
   assert.equal(await run('heroTimers.size'),1,'Exactly one timer is active');
   assert.ok(await run('[...heroTimers.values()][0].delay')<=5000);
   await run(`(()=>{const [id,timer]=[...heroTimers][0];heroTimers.delete(id);timer.fn(...timer.args)})()`);await pause(80);
   await run(`document.getAnimations().filter(a=>a.id==='xstx-hero-crossfade').forEach(a=>a.finish())`);await pause(30);
  };
  await run(`(()=>{const next=seed();next.dishes=next.dishes.slice(0,4).map((d,i)=>({...d,id:'h'+i,cover:i===3?'':d.cover}));next.records=next.dishes.map((d,i)=>({id:'hr'+i,dishId:d.id,mealId:null,date:d.created,note:'',photos:i===3?['brunch']:[]}));next.meals=[];commit(next);setView('menu')})()`);
  const seen=[await id()];for(let i=0;i<3;i++){await tick();seen.push(await id())}
  assert.equal(new Set(seen).size,4,'Every dish, including record-only photos, gets a turn before repetition');
  assert.ok(seen.includes('h3'));
  await tick();assert.notEqual(await id(),seen.at(-1),'No same dish across round boundaries');
  await run(`setView('favorites')`);assert.equal(await run('heroTimers.size'),0);
  await run(`setView('menu');document.getElementById('globalSearch').value='不存在';document.getElementById('globalSearch').dispatchEvent(new Event('input',{bubbles:true}))`);
  assert.equal(await run(`!!document.querySelector('.hero')`),false);assert.equal(await run('heroTimers.size'),0);
  await run(`setView('menu');openForm()`);await pause(20);assert.equal(await run('heroTimers.size'),0,'Form dialog pauses cover rotation');
  await click('#formDialog [data-action="close"]');await pause(20);assert.equal(await run('heroTimers.size'),1);
  // Deleting the currently shown dish cannot leave a stale detail link behind.
  await run(`(()=>{const id=document.querySelector('.hero-image').dataset.id;const next=structuredClone(state);next.dishes=next.dishes.filter(d=>d.id!==id);next.records=next.records.filter(r=>r.dishId!==id);commit(next);render()})()`);
  assert.ok(await run(`!!dishBy(document.querySelector('.hero-image').dataset.id)`));
  await run(`(()=>{const next=structuredClone(state);next.dishes=[next.dishes[0]];next.dishes[0].cover='rice';next.records=[];commit(next);render()})()`);
  assert.equal(await run('heroTimers.size'),0,'One photo stays still');
  await run(`(()=>{const next=structuredClone(state);next.dishes[0].cover='';commit(next);render()})()`);
  assert.match(await run(`document.querySelector('.hero-caption b').textContent`),/等一张照片/);assert.equal(await run('heroTimers.size'),0);
  await run(`(()=>{const next=structuredClone(state);next.dishes=[];commit(next);render()})()`);
  assert.equal(await run(`document.querySelector('.hero-image').dataset.action`),'add');
  assert.equal(await run(`document.querySelector('.hero-image').querySelector('img').src===img('')`),true);
  await click('.hero-image');assert.equal(await run(`document.getElementById('formDialog').open`),true);await click('#formDialog [data-action="close"]');
  await run(`commit(seed());setView('menu')`);
  await win.webContents.debugger.attach('1.3');
  await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await pause(40);
  await tick();assert.equal(await run(`document.getAnimations().filter(a=>a.id==='xstx-hero-crossfade').length`),0);
  assert.equal(await run(`document.querySelectorAll('.hero-slide').length`),1,'Reduced motion switches without animation');
  win.webContents.debugger.detach();
  assert.deepEqual(failures,[]);
  console.log('PASS: real five-second cadence; predecoded layered crossfade; image/caption/detail synchronization during blend; random rounds; record-only photos; re-render retention; navigation/search/dialog timer cleanup; deleted dish; single/empty photos; empty collection CTA; reduced motion');
  app.exit(0);
 }catch(error){console.error(error.stack||error);app.exit(1)}
});
