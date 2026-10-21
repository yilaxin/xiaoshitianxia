const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const project=path.resolve(__dirname,'..');
const profile=fs.mkdtempSync(path.join(project,'work/book-wheel-'));
process.env.XSTX_HEADLESS_TEST='1';process.argv.push('--data-dir='+profile);
require('../dist-app/main.cjs');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
app.whenReady().then(async()=>{
 try{
  const win=BrowserWindow.getAllWindows()[0];
  await new Promise((resolve,reject)=>{win.webContents.once('did-finish-load',resolve);win.webContents.once('did-fail-load',(_e,c,d)=>reject(Error(c+': '+d)))});
  win.webContents.debugger.attach('1.3');
  const run=s=>win.webContents.executeJavaScript(s,true);
  const ready=async s=>{for(let i=0;i<100;i++){if(await run(s))return;await pause(20)}throw Error('Timed out: '+s)};
  const wheel=async(selector,deltaY)=>{
   const point=await run(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:Math.round(r.x+r.width*.6),y:Math.round(Math.max(0,r.y)+Math.min(r.height,innerHeight-Math.max(0,r.y))*.45)}})()`);
   // Wait for the renderer to acknowledge the new hit target. A fixed 40ms
   // delay can race the offscreen compositor after the outer page scrolls.
   // The wheel itself still goes through Electron's native input path.
   await win.webContents.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mouseMoved',...point});
   win.webContents.sendInputEvent({type:'mouseWheel',...point,deltaX:0,deltaY});
   await pause(160);
  };
  const turn=async direction=>{await run(`void flipBook(${direction})`);await ready('!bookBusy');};
  const expectOuterScroll=async(selector,delta,label)=>{
   const before=await run('scrollY');await wheel(selector,delta);const after=await run('scrollY');
   const debug=await run(`(()=>{const e=document.querySelector('#bookSpread>.book-right');return {innerScroll:e.scrollTop,innerMax:e.scrollHeight-e.clientHeight,outerMax:document.documentElement.scrollHeight-innerHeight,overscroll:getComputedStyle(e).overscrollBehaviorY,pointer:getComputedStyle(e).pointerEvents}})()`);
   assert.ok(delta<0?after>before:after<before,`${label}: wheel must scroll immediately (before=${before}, after=${after}, ${JSON.stringify(debug)})`);
  };
  win.setContentSize(1050,650);await pause(120);
  await run(`setView('book');bookCover=false;state.bookIndex=0;render();window.scrollTo(0,0)`);await pause(450);
  // At a text boundary, scrolling should pass directly to the main document.
  await turn(1);
  await run(`document.querySelector('#bookSpread>.book-right').scrollTop=1e6`);await pause(80);
  await expectOuterScroll('#bookSpread>.book-right',-90,'Right page immediately after next page');
  await run(`document.querySelector('#bookSpread>.book-right').scrollTop=0`);await pause(80);
  await expectOuterScroll('#bookSpread>.book-right',90,'Right page reverse scroll');
  await turn(-1);
  await expectOuterScroll('#bookSpread>.book-left',-90,'Photo after previous page');
  await expectOuterScroll('#bookSpread>.book-right',90,'Right page after previous page');
  // Long text still scrolls inside the sheet, then hands scrolling back at both edges.
  await run(`state.dishes[1].description='长篇用餐回忆，记录每一口的味道。'.repeat(100);state.bookIndex=0;render();window.scrollTo(0,0)`);await pause(120);
  await turn(1);
  await wheel('#bookSpread>.book-right',-90);
  assert.ok(await run(`document.querySelector('#bookSpread>.book-right').scrollTop>0`),'Long notes scroll inside right sheet');
  assert.equal(await run('scrollY'),0,'Inner text consumes wheel before reaching boundary');
  await run(`document.querySelector('#bookSpread>.book-right').scrollTop=1e6`);await pause(600);
  await expectOuterScroll('#bookSpread>.book-right',-90,'Long notes bottom boundary');
  await run(`document.querySelector('#bookSpread>.book-right').scrollTop=0`);await pause(600);
  await expectOuterScroll('#bookSpread>.book-right',90,'Long notes top boundary');
  // Fullscreen intentionally fixes the document; long text must remain scrollable.
  await run(`document.querySelector('[data-action="bookFullscreen"]').click()`);await ready(`document.body.classList.contains('book-fullscreen')`);await pause(600);
  await wheel('#bookSpread>.book-right',-90);
  assert.ok(await run(`document.querySelector('#bookSpread>.book-right').scrollTop>0`),'Fullscreen long notes scroll');
  assert.equal(await run('scrollY'),0,'Fullscreen outer document stays fitted');
  console.log('PASS: real mouse wheel immediately after forward/back turns; photo/right page; long notes internal scrolling and both boundary handoffs; fullscreen text scrolling');
  app.exit(0);
 }catch(error){console.error(error.stack||error);app.exit(1)}
});
