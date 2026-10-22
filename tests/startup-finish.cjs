'use strict';
const {app,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');process.env.XSTX_HEADLESS_TEST='1';process.env.XSTX_STARTUP_TEST='1';
const profile=fs.mkdtempSync(path.join(root,'work/startup-finish-'));process.argv.push('--data-dir='+profile);
require(path.join(root,process.env.XSTX_TEST_BUILD||'dist-app','main.cjs'));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
app.whenReady().then(async()=>{try{
 const win=BrowserWindow.getAllWindows()[0];win.webContents.debugger.attach('1.3');await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
 if(win.webContents.isLoading())await new Promise(r=>win.webContents.once('did-finish-load',r));const run=s=>win.webContents.executeJavaScript(s,true);
 for(let i=0;i<200&&!(await run(`globalThis.StartupIntro?.phase==='waiting'`));i++)await wait(20);
 const saved=fs.readFileSync(path.join(profile,'菜单资料.json'));
 const result=await run(`(async()=>{const home=document.querySelector('.app');document.querySelector('[data-action="openStartup"]').click();const origin=performance.now();while(performance.now()-origin<360){}const samples=[];while(StartupIntro.active&&performance.now()-origin<4600){samples.push({ms:performance.now()-origin,phase:StartupIntro.phase,home:Number(getComputedStyle(home).opacity),skip:Number(getComputedStyle(document.querySelector('[data-action="skipStartup"]')).opacity)});await new Promise(r=>requestAnimationFrame(r));}return {samples,elapsed:performance.now()-origin,active:StartupIntro.active,overlay:!!document.getElementById('startupIntro'),inert:home.inert,home:Number(getComputedStyle(home).opacity)};})()`);
 assert.equal(result.active,false);assert.equal(result.overlay,false);assert.equal(result.inert,false);assert.equal(result.home,1);
 assert.ok(result.samples.length>5);
 const last=result.samples.at(-1);
 assert.ok(last.home>.98,'实际最后一帧必须完成主页渐显，不能被固定定时器截断：'+JSON.stringify(last));
 assert.ok(result.samples.filter(s=>s.phase==='revealing').every(s=>s.skip>.99),'过渡期间跳过按钮不能单独提前消失');
 // The final sample precedes completion by one frame; measure completion itself.
 const timing=await run('StartupIntro.timing');
 assert.equal(timing.reason,'complete','应由动画完成收尾：'+JSON.stringify(timing));
 const elapsed=timing.finishedAt-timing.animationStartedAt;
 assert.ok(elapsed>=2550&&elapsed<3500,'首次绘制延迟后仍完整播放 2.6 秒可见动画：'+JSON.stringify({timing,last}));
 assert.deepEqual(fs.readFileSync(path.join(profile,'菜单资料.json')),saved);
 console.log('PASS: immediate cover click with delayed first frame; complete final fade; visible skip; no fixed-timer cut; cleanup and data preservation');app.exit(0);
}catch(e){console.error(e.stack||e);app.exit(1)}});
