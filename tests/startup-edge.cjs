'use strict';
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const args=new Set(process.argv.slice(1));
const mode=['--escape','--button','--hang-escape','--hang-watchdog','--small'].find(m=>args.has(m));
if(!mode) throw Error('startup-edge requires one mode: --escape, --button, --hang-escape, --hang-watchdog, --small');
const hang=mode==='--hang-escape'||mode==='--hang-watchdog';
const project=path.resolve(__dirname,'..');
const profile=fs.mkdtempSync(path.join(project,'work/startup-edge-'));
process.env.XSTX_HEADLESS_TEST='1';
process.env.XSTX_STARTUP_TEST='1';
if(hang) process.env.XSTX_STARTUP_TEST_HANG='1';
process.argv.push('--data-dir='+profile);
const appRoot=path.join(project,process.env.XSTX_TEST_BUILD||'dist-app');
require(path.join(appRoot,'main.cjs'));
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
app.whenReady().then(async()=>{
 try{
  const win=BrowserWindow.getAllWindows()[0];
  if(!win) throw Error('主窗口未创建');
  if(mode==='--small'){win.setContentSize(900,650);win.setSize(900,650);}
  win.webContents.debugger.attach('1.3');
  await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  if(win.webContents.isLoading()){
   await new Promise((resolve,reject)=>{win.webContents.once('did-finish-load',resolve);win.webContents.once('did-fail-load',(_e,code,desc)=>reject(Error(code+': '+desc)))});
  }
  const run=s=>win.webContents.executeJavaScript(s,true);
  const ready=async predicate=>{for(let i=0;i<300;i++){if(await run(predicate))return;await wait(20)}throw Error('Timed out: '+predicate)};
  await ready('!!window.StartupIntro');
  const waitFor=async(predicate,timeout)=>{const start=Date.now();while(Date.now()-start<timeout){if(await run(predicate))return true;await wait(20)}return false};

  if(mode==='--escape'||mode==='--button'){
   await ready('StartupIntro.phase === "waiting"');
   await run(`document.querySelector('[data-action="openStartup"]').click()`);
   await ready('StartupIntro.active===true && !!document.getElementById("startupIntro")');
   const start=Date.now();
   if(mode==='--escape'){
    await run(`document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));true`);
   }else{
    await run(`document.querySelector('[data-action="skipStartup"]').click();true`);
   }
   assert.equal(await waitFor(`!document.getElementById('startupIntro') && StartupIntro.phase==='done'`,2000),true,'skip 必须在活动期间立即收尾');
   const elapsed=Date.now()-start;
   assert.ok(elapsed<1500,'活动期间跳过应远早于 2600ms，实际 '+elapsed+'ms');
   assert.equal(await run(`StartupIntro.active`),false);
   assert.equal(await run(`StartupIntro.phase`),'done');
   assert.equal(await run(`document.documentElement.classList.contains('startup-active')`),false);
   assert.equal(await run(`document.querySelector('.app').inert`),false);
   assert.equal(await run(`(()=>{try{StartupIntro.skip('again');StartupIntro.skip('again');return true}catch(e){return false}})()`),true,'skip 必须幂等');
   console.log('PASS: startup-edge '+mode+' (active skip, cleanup, idempotent)');
  }else if(mode==='--hang-escape'){
   assert.equal(await run(`!!document.getElementById('startupIntro')`),true,'等待期遮罩必须存在');
   assert.equal(await run(`StartupIntro.active`),false,'whenShown 未返回时不得提前开始动画');
   await wait(250);
   const start=Date.now();
   await run(`document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));true`);
   assert.equal(await waitFor(`!document.getElementById('startupIntro') && StartupIntro.phase==='done'`,1500),true,'等待期 Esc 必须立即可用');
   assert.ok(Date.now()-start<1200,'等待期 Esc 应快速释放遮罩');
   assert.equal(await run(`document.documentElement.classList.contains('startup-active')`),false);
   console.log('PASS: startup-edge --hang-escape (Esc usable before whenShown)');
  }else if(mode==='--hang-watchdog'){
   const start=Date.now();
   assert.equal(await run(`!!document.getElementById('startupIntro')`),true,'等待期遮罩必须存在');
   assert.equal(await waitFor(`!document.getElementById('startupIntro') && StartupIntro.phase==='done'`,6500),true,'whenShown 未返回时看门狗必须在最多 5 秒释放');
   const elapsed=Date.now()-start;
   assert.ok(elapsed>3000,'看门狗不应过早释放，实际 '+elapsed+'ms');
   assert.ok(elapsed<6000,'看门狗必须按最多 5 秒释放，实际 '+elapsed+'ms');
   assert.equal(await run(`StartupIntro.active`),false);
   assert.equal(await run(`document.documentElement.classList.contains('startup-active')`),false);
   console.log('PASS: startup-edge --hang-watchdog (bounded waiting release '+elapsed+'ms)');
  }else if(mode==='--small'){
   const innerWidth=await run(`window.innerWidth`);
   assert.ok(innerWidth>=899&&innerWidth<=901,'900x650 视口宽度异常: '+innerWidth);
   let found=false;
   for(let i=0;i<200;i++){
    const info=await run(`(()=>{const c=document.querySelector('.startup-cover');if(!c)return null;const r=c.getBoundingClientRect();return {phase:StartupIntro.phase,active:StartupIntro.active,center:r.left+r.width/2,innerWidth:window.innerWidth};})()`);
    if(info&&info.active&&info.phase==='waiting'){
     await wait(180);
     const c=await run(`(()=>{const r=document.querySelector('.startup-cover').getBoundingClientRect();return {center:r.left+r.width/2,innerWidth:window.innerWidth};})()`);
     assert.ok(Math.abs(c.center-c.innerWidth/2)<4,'900x650 合上书封面应视觉居中，center='+c.center+' innerCenter='+(c.innerWidth/2));
     const fit=await run(`(()=>{const cover=document.querySelector('[data-action="openStartup"]').getBoundingClientRect(),hint=document.querySelector('.startup-open-hint').getBoundingClientRect(),logo=document.querySelector('.startup-logo').getBoundingClientRect();return {bottom:cover.bottom,hintBottom:hint.bottom,logoRatio:logo.width/logo.height,height:innerHeight};})()`);
     assert.ok(fit.hintBottom<fit.bottom&&fit.bottom<fit.height,'小窗口点击提示与封面必须完整显示');
     assert.ok(Math.abs(fit.logoRatio-1)<.02,'小窗口 Logo 不得受挤压变形');
     found=true;
     break;
    }
    await wait(10);
   }
   assert.ok(found,'900x650 未观察到 arriving 活动阶段');
   const sc=await run(`(()=>{const html=document.documentElement;return {htmlOverflow:getComputedStyle(html).overflow,bodyOverflow:getComputedStyle(document.body).overflow,htmlStyle:html.style.overflow,bodyStyle:document.body.style.overflow};})()`);
   assert.ok(sc.htmlStyle==='hidden'||sc.htmlOverflow==='hidden','启动期间 html 不得出现滚动条');
   assert.ok(sc.bodyStyle==='hidden'||sc.bodyOverflow==='hidden','启动期间 body 不得出现滚动条');
   await run(`document.querySelector('[data-action="openStartup"]').click()`);
   assert.equal(await waitFor(`StartupIntro.phase==='done' && !document.getElementById('startupIntro')`,3500),true,'900x650 正常动画必须完成');
   assert.equal(await run(`StartupIntro.active`),false);
   console.log('PASS: startup-edge --small (900x650 center, no scrollbar, full completion)');
  }
  win.webContents.debugger.detach();
  app.exit(0);
 }catch(error){
  console.error(error.stack||error);
  try{BrowserWindow.getAllWindows()[0]?.webContents.debugger.detach()}catch(_e){}
  app.exit(1);
 }
});
