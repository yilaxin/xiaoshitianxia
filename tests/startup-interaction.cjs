'use strict';
const {app, BrowserWindow} = require('electron');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const profile = fs.mkdtempSync(path.join(root, 'work/startup-click-'));
process.env.XSTX_HEADLESS_TEST = '1';
process.env.XSTX_STARTUP_TEST = '1';
process.argv.push('--data-dir=' + profile);
require(path.join(root, process.env.XSTX_TEST_BUILD || 'dist-app', 'main.cjs'));
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
app.whenReady().then(async () => {
  try {
    const win = BrowserWindow.getAllWindows()[0];
    if (win.webContents.isLoading()) await new Promise(resolve => win.webContents.once('did-finish-load', resolve));
    const run = script => win.webContents.executeJavaScript(script, true);
    for (let i = 0; i < 200 && !await run(`globalThis.StartupIntro?.phase === 'waiting'`); i++) await wait(20);
    assert.equal(await run(`StartupIntro.phase`), 'waiting');
    const saved = fs.readFileSync(path.join(profile, '菜单资料.json'));
    const info = await run(`(()=>{const cover=document.querySelector('[data-action="openStartup"]'),c=cover.getBoundingClientRect();return {color:getComputedStyle(cover).backgroundColor,theme:getComputedStyle(document.querySelector('.btn.primary')).backgroundColor,page:getComputedStyle(document.querySelector('.startup-page')).visibility,spine:getComputedStyle(document.querySelector('.startup-spine')).visibility,focus:document.activeElement===cover,center:c.x+c.width/2,w:innerWidth,home:getComputedStyle(document.querySelector('.app')).opacity}})()`);
    assert.equal(info.color, info.theme, '书封与主页按钮共用主题色');
    assert.equal(info.page, 'hidden'); assert.equal(info.spine, 'hidden');
    assert.equal(info.focus, true); assert.equal(info.home, '0');
    assert.ok(Math.abs(info.center - info.w / 2) < 2);
    await wait(5500);
    assert.equal(await run(`StartupIntro.phase`), 'waiting', '等待用户不得触发 5 秒异常看门狗或自动翻开');
    assert.equal(await run(`document.getElementById('startupIntro').getAnimations({subtree:true}).length`), 0, '等待封面不运行循环动画');
    // Native Enter activation uses the same accessible button as a mouse click.
    win.webContents.debugger.attach('1.3');
    await win.webContents.debugger.sendCommand('Emulation.setFocusEmulationEnabled', {enabled:true});
    await run(`document.querySelector('[data-action="openStartup"]').focus()`);
    win.webContents.focus();
    win.webContents.sendInputEvent({type:'keyDown', keyCode:'Enter'});
    win.webContents.sendInputEvent({type:'char', keyCode:'\r'});
    win.webContents.sendInputEvent({type:'keyUp', keyCode:'Enter'});
    const start = Date.now();
    for (let i = 0; i < 20 && await run(`StartupIntro.phase === 'waiting'`); i++) await wait(20);
    const first = await run(`StartupIntro.phase`);
    assert.notEqual(first, 'waiting', '回车应打开封面');
    await run(`document.querySelector('[data-action="openStartup"]').click();StartupIntro.start();`);
    const samples = await run(`(async()=>{const samples=[];while(StartupIntro.active){const b=document.querySelector('.startup-paper-bridge'),r=b?.getBoundingClientRect();samples.push({time:performance.now(),phase:StartupIntro.phase,home:Number(getComputedStyle(document.querySelector('.app')).opacity),overlay:Number(getComputedStyle(document.getElementById('startupIntro')).opacity),paperOpacity:Number(getComputedStyle(b).opacity),paperWidth:r?.width,paperHeight:r?.height,homeWidth:document.querySelector('.app').getBoundingClientRect().width,w:innerWidth,h:innerHeight});await new Promise(r=>setTimeout(r,30));}return samples;})()`);
    const elapsed = Date.now() - start;
    assert.ok(elapsed >= 2350 && elapsed < 3500, '点击后保持约 2.6 秒，重复点击不重启：' + elapsed);
    const reveal = samples.filter(s => s.phase === 'revealing');
    const finalWidth = await run(`document.querySelector('.app').getBoundingClientRect().width`);
    assert.ok(reveal.length >= 3);
    assert.ok(reveal.some(s => s.home > .15 && s.home < .85), '首页渐显而非瞬间切换');
    for (const sample of reveal) {
      assert.equal(sample.homeWidth, finalWidth, '主页渐显到结束不因滚动条恢复改变宽度');
      assert.ok(Math.abs(sample.home + sample.overlay - 1) < .04, '首页与遮罩同步淡入淡出');
      assert.ok(Math.abs(sample.paperWidth - sample.w) < 2 && Math.abs(sample.paperHeight - sample.h) < 2, '首页出现前纸面已铺满窗口');
    }
    assert.equal(await run(`document.querySelector('.app').inert`), false);
    assert.equal(await run(`getComputedStyle(document.querySelector('.app')).opacity`), '1');
    assert.equal(await run(`document.getAnimations().some(a=>a.effect?.target?.closest?.('#startupIntro')||a.effect?.target===document.querySelector('.app'))`), false, '结束后释放动画对象');
    assert.deepEqual(fs.readFileSync(path.join(profile, '菜单资料.json')), saved, '开场和点击不写入用户资料');
    console.log('PASS: click-to-open; indefinite stationary cover; shared theme color; keyboard activation; 2600ms; full-viewport paper; synchronized home crossfade; cleanup; saved data intact');
    app.exit(0);
  } catch (error) { console.error(error.stack || error); app.exit(1); }
});
