 'use strict';
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const dataArg=process.argv.find(v=>v.startsWith('--data-dir='));
if(!dataArg) throw Error('startup-reload-phase1 requires --data-dir');
const profile=path.resolve(dataArg.slice(11));
const project=path.resolve(__dirname,'..');
process.env.XSTX_HEADLESS_TEST='1';
process.env.XSTX_STARTUP_TEST='1';
const appRoot=path.join(project,process.env.XSTX_TEST_BUILD||'dist-app');
require(path.join(appRoot,'main.cjs'));
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
app.whenReady().then(async()=>{
 try{
  const win=BrowserWindow.getAllWindows()[0];
  if(!win) throw Error('主窗口未创建');
  win.webContents.debugger.attach('1.3');
  await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  if(win.webContents.isLoading()){
   await new Promise((resolve,reject)=>{win.webContents.once('did-finish-load',resolve);win.webContents.once('did-fail-load',(_e,code,desc)=>reject(Error(code+': '+desc)))});
  }
  const run=s=>win.webContents.executeJavaScript(s,true);
  const ready=async predicate=>{for(let i=0;i<300;i++){if(await run(predicate))return;await wait(20)}throw Error('Timed out: '+predicate)};
  await ready('!!window.StartupIntro');

  const initial=await run(`(()=>({hasIntro:!!document.getElementById('startupIntro'),active:StartupIntro.active,phase:StartupIntro.phase,startupPref:state.preferences.startupAnimation,bookIndex:state.bookIndex,note:state.records[0].note}))()`);
  assert.equal(initial.hasIntro,false,'preferences.startupAnimation=false 冷启动不应留下启动遮罩');
  assert.equal(initial.active,false,'preferences.startupAnimation=false 冷启动不得处于活动动画');
  assert.equal(initial.phase,'done','关闭偏好时应走立即收尾路径');
  assert.equal(initial.startupPref,false,'预置偏好必须是 false');
  assert.equal(initial.bookIndex,2,'预置阅读位置应保留');
  assert.equal(initial.note,'reload-state-marker','预置记录应保留');
  await wait(300);
  assert.equal(await run(`!!document.getElementById('startupIntro')`),false,'关闭偏好等待后不得出现遮罩');

  const enabled=await run(`(()=>{setView('settings');const box=document.querySelector('[data-action="toggleStartupAnimation"]');box.click();return state.preferences.startupAnimation;})()`);
  assert.equal(enabled,true,'设置开关应把 startupAnimation 改为 true');
  const afterEnable=await run(`(()=>({startupPref:state.preferences.startupAnimation,bookIndex:state.bookIndex,note:state.records[0].note}))()`);
  assert.equal(afterEnable.startupPref,true);
  assert.equal(afterEnable.bookIndex,2,'启用开关不得改变阅读位置');
  assert.equal(afterEnable.note,'reload-state-marker','启用开关不得改变记录');
  const disk=JSON.parse(fs.readFileSync(path.join(profile,'菜单资料.json'),'utf8'));
  assert.equal(disk.preferences.startupAnimation,true,'启用后偏好必须持久化');
  assert.equal(disk.bookIndex,2,'持久化阅读位置保留');
  assert.equal(disk.records[0].note,'reload-state-marker','持久化记录保留');

  const reloaded=new Promise((resolve,reject)=>{win.webContents.once('did-finish-load',resolve);win.webContents.once('did-fail-load',(_e,code,desc)=>reject(Error(code+': '+desc)))});
  win.webContents.reload();
  await reloaded;
  await ready('!!window.StartupIntro');
  await wait(250);
  const afterReload=await run(`(()=>({hasIntro:!!document.getElementById('startupIntro'),active:StartupIntro.active,phase:StartupIntro.phase,startupPref:state.preferences.startupAnimation,bookIndex:state.bookIndex,note:state.records[0].note}))()`);
  assert.equal(afterReload.hasIntro,false,'同进程 reload 不得重播启动动画');
  assert.equal(afterReload.active,false,'同进程 reload 不得重新激活 StartupIntro');
  assert.equal(afterReload.startupPref,true,'reload 后应保留已开启偏好');
  assert.equal(afterReload.bookIndex,2,'reload 后阅读位置保留');
  assert.equal(afterReload.note,'reload-state-marker','reload 后记录保留');
  await wait(500);
  assert.equal(await run(`!!document.getElementById('startupIntro')`),false,'reload 后等待期不得出现启动遮罩');
  assert.equal(await run(`StartupIntro.active`),false,'reload 后不得出现活动动画');

  win.webContents.debugger.detach();
  console.log('PASS: startup reload phase1 (disabled cold start, enable, reload no replay, state preserved)');
  app.exit(0);
 }catch(error){
  console.error(error.stack||error);
  try{BrowserWindow.getAllWindows()[0]?.webContents.debugger.detach()}catch(_e){}
  app.exit(1);
 }
});
