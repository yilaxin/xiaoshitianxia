 'use strict';
const {app,BrowserWindow}=require('electron');
const path=require('node:path');
const assert=require('node:assert/strict');
const dataArg=process.argv.find(v=>v.startsWith('--data-dir='));
if(!dataArg) throw Error('startup-reload-phase2 requires --data-dir');
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
  const waitFor=async(predicate,timeout)=>{const start=Date.now();while(Date.now()-start<timeout){if(await run(predicate))return true;await wait(20)}return false};
  await waitFor('!!window.StartupIntro',4000)||(()=>{throw Error('StartupIntro 未定义')})();
  assert.equal(await waitFor('StartupIntro.active===true && !!document.getElementById("startupIntro")',4000),true,'新进程在已开启偏好下应正常播放启动动画');
  const info=await run(`(()=>({active:StartupIntro.active,duration:StartupIntro.duration,phase:StartupIntro.phase,hasIntro:!!document.getElementById('startupIntro'),startupPref:state.preferences.startupAnimation,bookIndex:state.bookIndex,note:state.records[0].note}))()`);
  assert.equal(info.active,true);
  assert.equal(info.duration,2600);
  assert.equal(info.hasIntro,true);
  assert.equal(info.startupPref,true,'新进程应保留已开启偏好');
  assert.equal(info.bookIndex,2,'新进程阅读位置保留');
  assert.equal(info.note,'reload-state-marker','新进程记录保留');
  assert.equal(info.phase,'waiting','新进程必须等待点击');
  await run(`document.querySelector('[data-action="openStartup"]').click()`);
  assert.equal(await waitFor('StartupIntro.phase==="done" && !document.getElementById("startupIntro")',4000),true,'新进程动画应完整结束并移除遮罩');
  assert.equal(await run(`StartupIntro.active`),false);
  win.webContents.debugger.detach();
  console.log('PASS: startup reload phase2 (new process plays normally, state preserved)');
  app.exit(0);
 }catch(error){
  console.error(error.stack||error);
  try{BrowserWindow.getAllWindows()[0]?.webContents.debugger.detach()}catch(_e){}
  app.exit(1);
 }
});
