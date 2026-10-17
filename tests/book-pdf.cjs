const {app,BrowserWindow,dialog}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),profile=fs.mkdtempSync(path.join(root,'work/book-pdf-')),output=path.join(root,'outputs/v'+require('../package.json').version+'/pdf');fs.mkdirSync(output,{recursive:true});
let destination=null,chooserCalls=0,holdChooser=false,releaseChooser,failPrint=false;
dialog.showSaveDialog=async()=>{chooserCalls++;if(holdChooser)return new Promise(r=>{releaseChooser=r});return destination?{canceled:false,filePath:destination}:{canceled:true};};
app.on('browser-window-created',(_event,w)=>{if(failPrint)w.webContents.printToPDF=async()=>{throw Error('模拟打印失败')};});
process.env.XSTX_HEADLESS_TEST='1';process.argv.push('--data-dir='+profile);require(path.join(root,process.env.XSTX_TEST_BUILD||'dist-app','main.cjs'));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
app.whenReady().then(async()=>{try{
 const win=BrowserWindow.getAllWindows()[0];await new Promise(r=>win.webContents.once('did-finish-load',r));const run=s=>win.webContents.executeJavaScript(s,true);
 const ready=async condition=>{for(let i=0;i<500;i++){if(await run(condition))return;await wait(30)}throw Error('Timed out: '+condition)};
 const {buildBookHtml,photoUrl}=require('../app/desktop/book-pdf.cjs');assert.equal(photoUrl('https://external/photo.png'),'');assert.equal(photoUrl('file:///private.txt'),'');assert.equal(photoUrl('local:../../private.png'),'');
 await ready(`typeof FoodBooks!=='undefined'&&typeof desktop.exportBookPdf==='function'`);
 const initial=await run('structuredClone(state)');
 assert.throws(()=>buildBookHtml(initial,{kind:'__proto__'}));assert.throws(()=>buildBookHtml(initial,{kind:'flavors',category:'不在分类中'}));
 await run(`FoodBooks.select('flavors')`);assert.equal(await run(`!!document.querySelector('[data-action="exportBookPdf"]')`),true);
 const file=path.join(profile,'菜单资料.json'),before=fs.readFileSync(file);
 holdChooser=true;await run(`document.querySelector('[data-action="exportBookPdf"]').click()`);await ready(`document.querySelector('[data-action="exportBookPdf"]').disabled`);
 await run(`document.querySelector('[data-action="exportBookPdf"]').click()`);assert.equal(chooserCalls,1);
 assert.match(await run(`desktop.exportBookPdf({kind:'flavors',category:'全部'}).catch(e=>e.message)`),/正在生成/);
 releaseChooser({canceled:true});holdChooser=false;await ready(`!document.querySelector('[data-action="exportBookPdf"]').disabled`);assert.equal(BrowserWindow.getAllWindows().length,1);assert.deepEqual(fs.readFileSync(file),before);
 // Real native IPC and Chromium PDF creation; renderer can only choose a book, never supply HTML or a path.
 async function exportTo(kind,name,category='全部'){
  destination=path.join(output,name+'.pdf');const snapshot=fs.readFileSync(file);
  const result=await run(`desktop.exportBookPdf(${JSON.stringify({kind,category})})`);assert.equal(result.canceled,false);assert.equal(result.path,destination);assert.match(fs.readFileSync(destination).subarray(0,8).toString(),/^%PDF-/);assert.deepEqual(fs.readFileSync(file),snapshot);assert.equal(BrowserWindow.getAllWindows().length,1,'Hidden PDF window is released');
 }
 await exportTo('flavors','flavors');await exportTo('flavors','favorites','特别喜欢');
 await run(`(()=>{const next=structuredClone(state);next.dishes.push({id:'no-photo',name:'无照片的记忆',category:'无图测试',tags:[],favorite:false,description:'<b>原文安全保留</b>',cover:'',created:TODAY});next.categories.push('无图测试');const r=next.recipes[0];r.steps[0].text+='\\n'+('长步骤的每一行都应完整保留。'.repeat(100));r.steps.at(-1).text+='\\n完整步骤结束标记';r.tips+='\\n'+('这是跨页心得。'.repeat(200))+'心得结束标记';next.meals[0].photos=['rice','pizza'];next.meals[0].note+='\\n整桌饭局专属说明';next.records.find(r=>r.mealId===next.meals[0].id).note+='\\n当餐记录结束标记';commit(next);})()`);
 await exportTo('flavors','no-photo','无图测试');await exportTo('recipes','recipes');await exportTo('feasts','feasts');
 // Error leaves a prior PDF intact and frees the print window and busy guard.
 destination=path.join(output,'recipes.pdf');const previousPdf=fs.readFileSync(destination);failPrint=true;
 assert.match(await run(`desktop.exportBookPdf({kind:'recipes'}).catch(e=>e.message)`),/模拟打印失败/);failPrint=false;assert.deepEqual(fs.readFileSync(destination),previousPdf);assert.equal(BrowserWindow.getAllWindows().length,1);
 destination=null;assert.equal((await run(`desktop.exportBookPdf({kind:'recipes'})`)).canceled,true);
 // UI success, fullscreen and narrow layouts, cancellation and empty-book feedback.
 await run(`FoodBooks.select('recipes')`);destination=path.join(output,'ui-recipes.pdf');await run(`document.querySelector('[data-action="exportBookPdf"]').click()`);await ready(`!document.querySelector('[data-action="exportBookPdf"]').disabled`);assert.ok(fs.existsSync(destination));assert.match(await run(`document.getElementById('toast').textContent`),/已保存为 PDF/);
 win.setContentSize(900,700);await run(`bookCover=false;render()`);await wait(150);assert.ok(await run('document.documentElement.scrollWidth<=innerWidth'));
 await run(`document.querySelector('[data-action="bookFullscreen"]').click()`);await wait(250);assert.ok(await run('document.documentElement.scrollWidth<=innerWidth'),'PDF toolbar fits fullscreen');await run(`document.querySelector('[data-action="bookFullscreen"]').click()`);await wait(200);
 await run(`(()=>{const next=structuredClone(state);next.recipes=[];commit(next);FoodBooks.select('recipes')})()`);assert.equal(await run(`document.querySelector('[data-action="exportBookPdf"]').disabled`),true);assert.match(await run(`desktop.exportBookPdf({kind:'recipes'}).catch(e=>e.message)`),/没有内容/);
 const check=spawnSync(process.env.XSTX_TEST_PYTHON||'python',[path.join(__dirname,'verify-book-pdf.py'),output],{encoding:'utf8'});process.stdout.write(check.stdout||'');process.stderr.write(check.stderr||'');assert.equal(check.status,0,'PDF text, pages, images and metadata verified');
 console.log('PASS: 3 complete book PDFs; cover/contents; current filter/favorites; real images; Chinese searchable text; long notes and steps; no photo; safe literal text; native chooser; cancel/busy/failed overwrite; state unchanged; print windows released; fullscreen/900px toolbar; empty books');app.exit(0);
 }catch(e){console.error(e.stack||e);app.exit(1)}});
