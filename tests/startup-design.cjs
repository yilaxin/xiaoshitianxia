'use strict';
const {app,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');process.env.XSTX_HEADLESS_TEST='1';process.env.XSTX_STARTUP_TEST='1';process.argv.push('--data-dir='+fs.mkdtempSync(path.join(root,'work/startup-design-')));
require(path.join(root,process.env.XSTX_TEST_BUILD||'dist-app','main.cjs'));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
app.whenReady().then(async()=>{try{
 const win=BrowserWindow.getAllWindows()[0];if(win.webContents.isLoading())await new Promise(r=>win.webContents.once('did-finish-load',r));const run=s=>win.webContents.executeJavaScript(s,true);
 for(let i=0;i<200&&!(await run(`globalThis.StartupIntro?.phase==='waiting'`));i++)await wait(20);
 for(const [w,h] of [[900,650],[1000,650],[1200,650],[1380,900],[1920,1080]]){
  win.setContentSize(w,h);let stable=0;
  for(let i=0;i<100&&stable<3;i++){const v=await run('[innerWidth,innerHeight]');stable=Math.abs(v[0]-w)<3&&Math.abs(v[1]-h)<3?stable+1:0;await wait(20);}
  assert.equal(stable,3,'Native viewport settled');
  const info=await run(`(()=>{const b=document.querySelector('.startup-cover-front').getBoundingClientRect(),l=document.querySelector('.startup-logo').getBoundingClientRect(),h=document.querySelector('.startup-open-hint').getBoundingClientRect(),a=document.querySelector('.startup-ambience');return {w:innerWidth,height:innerHeight,cover:{x:b.x,y:b.y,w:b.width,h:b.height,bottom:b.bottom},logoRatio:l.width/l.height,hintBottom:h.bottom,hidden:a.getAttribute('aria-hidden'),pointer:getComputedStyle(a).pointerEvents,controls:a.querySelectorAll('button,a,input').length,phase:StartupIntro.phase};})()`);
  assert.equal(info.phase,'waiting');assert.ok(Math.abs(info.cover.x+info.cover.w/2-info.w/2)<2,'封面始终居中');
  assert.ok(info.cover.y>0&&info.cover.bottom<info.height,'封面完整显示');assert.ok(info.hintBottom<info.cover.bottom-2,'提示不溢出');
  assert.ok(Math.abs(info.logoRatio-1)<.01,'所有尺寸的 Logo 保持正方形');
  if(w===1380){assert.ok(info.cover.w>480&&info.cover.h>650,'常规桌面书封明显放大');}
  assert.equal(info.hidden,'true');assert.equal(info.pointer,'none');assert.equal(info.controls,0);
 }
 await run(`StartupIntro.skip('design-test')`);
 console.log('PASS: enlarged centered cover; 5 settled viewport sizes; square Logo; fitting content; noninteractive accessible decorative margins');app.exit(0);
}catch(e){console.error(e.stack||e);app.exit(1)}});
