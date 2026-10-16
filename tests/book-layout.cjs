const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const project=path.resolve(__dirname,'..');
const profile=fs.mkdtempSync(path.join(project,'work/book-layout-'));
const images=path.join(project,'outputs/v'+require('../package.json').version);
fs.mkdirSync(images,{recursive:true});
process.env.XSTX_HEADLESS_TEST='1';process.argv.push('--data-dir='+profile);
require('../dist-app/main.cjs');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
app.whenReady().then(async()=>{
 try{
  const win=BrowserWindow.getAllWindows()[0];
  await new Promise((resolve,reject)=>{win.webContents.once('did-finish-load',resolve);win.webContents.once('did-fail-load',(_e,c,d)=>reject(Error(c+': '+d)))});
  const run=s=>win.webContents.executeJavaScript(s,true);
  const ready=async s=>{for(let i=0;i<60;i++){if(await run(s))return;await pause(30)}throw Error('Timed out: '+s)};
  const box=()=>run(`(()=>{const book=document.getElementById('bookSpread');const rect=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height}};return {book:rect('#bookSpread'),stage:rect('.book-stage'),photo:rect('#bookSpread>.book-left img'),nav:rect('.book-nav'),scroll:scrollY}})()`);
  const same=(before,after,label)=>{for(const name of ['book','stage','photo','nav'])for(const key of ['x','y','width','height'])assert.ok(Math.abs(before[name][key]-after[name][key])<.6,`${label}: ${name}.${key} shifted by ${after[name][key]-before[name][key]}`);assert.ok(Math.abs(before.scroll-after.scroll)<.6,label+': document scroll changed')};
  const capture=async name=>{await pause(100);await win.webContents.capturePage();fs.writeFileSync(path.join(images,name),(await win.webContents.capturePage()).toPNG())};
  const flip=async(direction,label)=>{
   const before=await box();await run(`void flipBook(${direction})`);await ready(`!!document.querySelector('.paper-leaf')`);
   await run(`document.getAnimations().filter(a=>a.id.startsWith('xstx-paper-')).forEach(a=>a.pause())`);
   for(const time of [0,220,500,820]){await run(`document.getAnimations().filter(a=>a.id.startsWith('xstx-paper-')).forEach(a=>a.currentTime=${time})`);same(before,await box(),label+' at '+time)}
   await run(`document.getAnimations().filter(a=>a.id.startsWith('xstx-paper-')).forEach(a=>a.finish())`);await ready('!bookBusy');
   same(before,await box(),label+' landed');
  };
  win.webContents.debugger.attach('1.3');
  await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  await run(`setView('book');bookCover=false;state.bookIndex=0;render()`);await pause(450);
  await ready(`document.querySelector('#bookSpread>.book-left img').naturalWidth>0`);
  await capture('书页稳定-第一页.png');await flip(1,'Original landscape to square');await capture('书页稳定-第二页.png');await flip(-1,'Original square to landscape');
  // Extreme user photo ratios and long notes must fit the same spread geometry.
  await run(`(()=>{const make=(w,h,color)=>{const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').fillStyle=color;c.getContext('2d').fillRect(0,0,w,h);return c.toDataURL('image/png')};state.dishes[0].cover=make(180,900,'#8b5f42');state.dishes[1].cover=make(1600,200,'#728653');state.dishes[1].name='这是一道名称特别长但不能把整本书撑大的美食';state.dishes[1].description='很长的品尝描述，依然需要完整查看。'.repeat(60);state.dishes[2].cover='';state.bookIndex=0;render()})()`);await pause(250);
  await flip(1,'Tall portrait to panorama with long notes');
  assert.equal(await run(`(()=>{const r=document.querySelector('#bookSpread>.book-right');return r.scrollHeight>r.clientHeight&&getComputedStyle(r).overflowY==='auto'})()`),true,'Long content remains accessible through page scrolling');
  await run(`document.querySelector('#bookSpread>.book-right').scrollTop=180`);
  const scroll=await run(`document.querySelector('#bookSpread>.book-right').scrollTop`);
  await run(`void flipBook(1)`);await ready(`!!document.querySelector('.paper-front .book-right')`);
  assert.equal(await run(`document.querySelector('.paper-front .book-right').scrollTop`),scroll,'Lifted sheet retains text scroll position');
  await run(`document.getAnimations().filter(a=>a.id.startsWith('xstx-paper-')).forEach(a=>a.finish())`);await ready('!bookBusy');
  assert.equal(await run(`document.querySelector('#bookSpread>.book-left img').getAttribute('src')===EMPTY_PHOTO`),true);
  await flip(-1,'No-photo placeholder to panorama');
  // A short window and page scroll must not turn the old height difference into a viewport jump.
  win.setContentSize(1050,740);await pause(300);
  await run(`state.bookIndex=0;render();window.scrollTo(0,document.documentElement.scrollHeight)`);await pause(150);
  assert.ok((await box()).scroll>0);
  await flip(1,'Narrow short window while scrolled');await flip(-1,'Reverse while scrolled');
  await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await pause(80);
  const beforeReduced=await box();await run(`void flipBook(1)`);same(beforeReduced,await box(),'Reduced motion switch');
  win.webContents.debugger.detach();
  console.log('PASS: book/stage/photo/nav geometry and scroll unchanged before, during and after real first/second-page turns; extreme portrait/panorama; long page content scroll; lifted text scroll retained; missing photo; narrow short viewport; reverse direction; reduced motion');
  app.exit(0);
 }catch(error){console.error(error.stack||error);app.exit(1)}
});
