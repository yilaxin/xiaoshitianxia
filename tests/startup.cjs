'use strict';
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const reduced=process.argv.includes('--reduced');
const project=path.resolve(__dirname,'..');
const profile=fs.mkdtempSync(path.join(project,'work/startup-'));
process.env.XSTX_HEADLESS_TEST='1';
process.env.XSTX_STARTUP_TEST='1';
process.argv.push('--data-dir='+profile);
const appRoot=path.join(project,process.env.XSTX_TEST_BUILD||'dist-app');
require(path.join(appRoot,'main.cjs'));
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
app.whenReady().then(async()=>{
 try{
  const win=BrowserWindow.getAllWindows()[0];
  if(!win)throw Error('主窗口未创建');
  win.webContents.debugger.attach('1.3');
  await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:reduced?'reduce':'no-preference'}]});
  if(win.webContents.isLoading()){
   await new Promise((resolve,reject)=>{win.webContents.once('did-finish-load',resolve);win.webContents.once('did-fail-load',(_e,code,desc)=>reject(Error(code+': '+desc)))});
  }
  const run=s=>win.webContents.executeJavaScript(s,true);
  const ready=async predicate=>{for(let i=0;i<150;i++){if(await run(predicate))return;await wait(20)}throw Error('Timed out: '+predicate)};
  await ready('!!window.StartupIntro');
  await ready('StartupIntro.phase === "waiting"');
  assert.equal(await run(`getComputedStyle(document.querySelector('.startup-page')).visibility`),'hidden','等待点击时只有封面');
  await run(`document.querySelector('[data-action="openStartup"]').click()`);
  const observed=await run(`(async()=>{
    const samples=[];const start=performance.now();
    while(performance.now()-start<3600){
      const intro=document.getElementById('startupIntro');
      samples.push({phase:StartupIntro.phase,active:StartupIntro.active,html:document.documentElement.classList.contains('startup-active'),appInert:document.querySelector('.app')?.inert===true,hasIntro:!!intro,firstId:document.body.firstElementChild?.id||null,opacity:intro?Number(getComputedStyle(intro).opacity):null,coverFront:!!document.querySelector('.startup-cover-front'),coverBack:!!document.querySelector('.startup-cover-back'),spine:!!document.querySelector('.startup-spine'),shadow:!!document.querySelector('.startup-shadow')});
      if(StartupIntro.phase==='done')break;
      await new Promise(r=>setTimeout(r,12));
    }
    return {samples,phase:StartupIntro.phase,active:StartupIntro.active,duration:StartupIntro.duration};
  })()`);
  assert.equal(observed.duration,2600);
  assert.equal(observed.active,false);
  assert.equal(observed.phase,'done');
  assert.equal(await run(`!!document.getElementById('startupIntro')`),false,'完成后必须移除遮罩');
  assert.equal(await run(`document.documentElement.classList.contains('startup-active')`),false,'完成后必须移除 startup-active');
  assert.equal(await run(`document.querySelector('.app').inert`),false,'完成后必须解除 inert');
  if(reduced){
   assert.ok(observed.samples.some(s=>s.active&&s.hasIntro),'reduce 路径也应真实经过活动遮罩');
   assert.ok(observed.samples.length>0,'reduce 路径缺少样本');
  }else{
   const phases=observed.samples.map(s=>s.phase);
   for(const p of ['arriving','opening','settling','revealing'])assert.ok(phases.includes(p),`缺少阶段 ${p}: ${JSON.stringify(phases)}`);
   assert.ok(observed.samples.some(s=>s.active&&s.html&&s.appInert&&s.hasIntro&&s.firstId==='startupIntro'),'active 时 html 必须带 startup-active 且 .app 必须 inert');
   assert.ok(observed.samples.some(s=>s.active&&s.coverFront&&s.coverBack&&s.spine&&s.shadow),'3D 纸张必须包含正反面、书脊和随角度变化阴影层');
   assert.ok(observed.samples.some(s=>s.active&&s.hasIntro&&s.opacity>0.9),'封面翻完前遮罩必须保持不透明');
  }
  // 完成后 start 不重播，skip 幂等。
  await run(`StartupIntro.start()`);
  assert.equal(await run(`!!document.getElementById('startupIntro')`),false);
  assert.equal(await run(`StartupIntro.active`),false);
  const skipOk=await run(`(()=>{try{StartupIntro.skip('test');StartupIntro.skip('test');return true}catch(e){return false}})()`);
  assert.equal(skipOk,true,'skip 必须幂等');
  if(!reduced){
   await run(`setView('settings')`);
   assert.equal(await run(`!!document.querySelector('[data-action="toggleStartupAnimation"]')`),true);
   assert.equal(await run(`document.querySelector('[data-action="toggleStartupAnimation"]').checked`),true);
   await run(`state.bookIndex=3;state.records[0].note='启动测试不覆盖';state.preferences.keepStartupToken='保留我';true`);
   const toggled=await run(`(()=>{setView('settings');const box=document.querySelector('[data-action="toggleStartupAnimation"]');box.checked=false;box.dispatchEvent(new Event('click',{bubbles:true}));return state.preferences.startupAnimation;})()`);
   assert.equal(toggled,false,'设置开关应保存为 false');
   assert.equal(await run(`state.bookIndex`),3,'开关保存不得改变书籍阅读位置');
   assert.equal(await run(`state.records[0].note`),'启动测试不覆盖','开关保存不得改变原记录');
   assert.equal(await run(`state.preferences.keepStartupToken`),'保留我','开关保存不得丢弃已有偏好字段');
   const disk=JSON.parse(fs.readFileSync(path.join(profile,'菜单资料.json'),'utf8'));
   assert.equal(disk.preferences.startupAnimation,false,'preferences.startupAnimation 必须持久化');
   assert.equal(disk.bookIndex,3,'bookIndex 持久化');
   assert.equal(disk.preferences.keepStartupToken,'保留我','已有偏好字段必须持久化');
   const rollback=await run(`(()=>{desktopReadOnly=true;const before=JSON.stringify(state);const beforeAnim=state.preferences.startupAnimation;toggleStartupAnimation();const unchangedAnim=state.preferences.startupAnimation===beforeAnim;const deepUnchanged=JSON.stringify(state)===before;const keep=state.preferences.keepStartupToken==='保留我';desktopReadOnly=false;return {unchangedAnim,deepUnchanged,keep};})()`);
   assert.equal(rollback.unchangedAnim,true,'保存失败必须回滚 startupAnimation');
   assert.equal(rollback.deepUnchanged,true,'保存失败不得部分改写任何字段');
   assert.equal(rollback.keep,true,'保存失败回滚必须保留已有偏好字段');
  }
  win.webContents.debugger.detach();
  console.log('PASS: startup animation '+(reduced?'reduced-motion':'full path')+'; fixed interface; overlay cleanup; skip/start idempotent; inert lifecycle; settings persistence; read-only protection');
  app.exit(0);
 }catch(error){
  console.error(error.stack||error);
  try{BrowserWindow.getAllWindows()[0]?.webContents.debugger.detach()}catch(_e){}
  app.exit(1);
 }
});


