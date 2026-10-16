const {app,BrowserWindow,clipboard,nativeImage}=require('electron');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const project=path.resolve(__dirname,'..'),profile=fs.mkdtempSync(path.join(project,'work/dish-image-'));
const output=path.join(project,'outputs/v'+require('../package.json').version);fs.mkdirSync(output,{recursive:true});
let written=null,writes=0,failNext=false;
// Verify real IPC/native image decoding without replacing the user's real clipboard.
assert.equal(typeof clipboard.write,'function');
clipboard.write=async items=>{const bytes=Buffer.from(await(await items[0].getType('image/png')).arrayBuffer());const picture=nativeImage.createFromBuffer(bytes);if(failNext){failNext=false;throw Error('测试剪贴板忙');}writes++;written={bytes:picture.toPNG(),size:picture.getSize()};};
process.env.XSTX_HEADLESS_TEST='1';process.argv.push('--data-dir='+profile);require('../dist-app/main.cjs');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
app.whenReady().then(async()=>{try{
 const win=BrowserWindow.getAllWindows()[0],errors=[];win.webContents.on('console-message',e=>{if(/Uncaught|TypeError|ReferenceError/.test(e.message))errors.push(e.message)});
 await new Promise((resolve,reject)=>{win.webContents.once('did-finish-load',resolve);win.webContents.once('did-fail-load',(_e,c,d)=>reject(Error(c+': '+d)))});
 const run=s=>win.webContents.executeJavaScript(s,true),click=s=>run(`document.querySelector(${JSON.stringify(s)}).click()`);
 const ready=async s=>{for(let i=0;i<200;i++){if(await run(s))return;await pause(30)}throw Error('Timed out: '+s)};
 const original=await run('JSON.stringify(state)');const disk=fs.readFileSync(path.join(profile,'菜单资料.json'),'utf8');
 await run(`(()=>{window.imageDrawn=[];const original=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(value,...args){window.imageDrawn.push(value);return original.call(this,value,...args)};openDish(state.dishes[0].id);document.getElementById('detailDialog').scrollTop=300;})()`);
 assert.equal(await run(`!!document.querySelector('[data-action="copyDishImage"]')`),true);await win.webContents.capturePage();fs.writeFileSync(path.join(output,'复制为图片-详情按钮.png'),(await win.webContents.capturePage()).toPNG());
 const beforeScroll=await run(`document.getElementById('detailDialog').scrollTop`);await click('[data-action="copyDishImage"]');assert.equal(await run(`document.querySelector('[data-action="copyDishImage"]').disabled`),true);await ready(`!document.querySelector('[data-action="copyDishImage"]').disabled`);
 assert.equal(writes,1);assert.equal(written.size.width,1200);assert.ok(written.size.height>1200);assert.ok(written.bytes.length>10000);fs.writeFileSync(path.join(output,'菜品信息-复制图片.png'),written.bytes);
 const drawn=await run('imageDrawn.join("")');assert.match(drawn,/鲜肉小笼包/);assert.match(drawn,/皮薄馅鲜/);assert.match(drawn,/2026 . 10 . 15/);assert.match(drawn,/2026 . 09 . 28/);assert.match(drawn,/趁热吃，先咬个小口喝汤/);assert.doesNotMatch(drawn,/删除这道菜|编辑这次记录|复制为图片/);
 assert.equal(await run(`document.getElementById('detailDialog').scrollTop`),beforeScroll);assert.equal(await run('JSON.stringify(state)'),original);assert.equal(fs.readFileSync(path.join(profile,'菜单资料.json'),'utf8'),disk);
 // A long note, line breaks and differently shaped photos all remain in the full image.
 await run(`(()=>{const d=state.dishes[0],r=state.records.find(r=>r.dishId===d.id);d.name='这是一道名字比较长的家常美味';d.description='描述也应当完整保留。'.repeat(40);r.note='第一段感想。\\n第二段感想，详细记下这一次的口味。'.repeat(50);const make=(w,h,color)=>{const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle=color;x.fillRect(0,0,w,h);return c.toDataURL()};r.photos=[make(100,700,'#734c34'),make(800,100,'#728652')];window.imageDrawn=[];openDish(d.id)})()`);
 await run(`void DishImage.copy(state.dishes[0].id);void DishImage.copy(state.dishes[0].id)`);await ready(`!document.querySelector('[data-action="copyDishImage"]').disabled`);assert.equal(writes,2,'Repeated clicks cannot duplicate an active generation');
 const text=await run(`imageDrawn.join('')`),note=await run(`state.records.find(r=>r.dishId===state.dishes[0].id).note`);assert.ok(text.includes(note.replaceAll('\n','')));fs.writeFileSync(path.join(output,'菜品信息-长记录.png'),written.bytes);
 await run(`state.dishes[0].cover='';state.dishes[0].description='';state.records=state.records.filter(r=>r.dishId!==state.dishes[0].id);openDish(state.dishes[0].id)`);await click('[data-action="copyDishImage"]');await ready(`!document.querySelector('[data-action="copyDishImage"]').disabled`);assert.equal(writes,3);assert.match(await run(`imageDrawn.join('')`),/照片待补充/);
 failNext=true;await click('[data-action="copyDishImage"]');await ready(`!document.querySelector('[data-action="copyDishImage"]').disabled`);assert.match(await run(`document.getElementById('toast').textContent`),/复制未完成/);assert.equal(writes,3,'Failed copy does not claim success');
 assert.equal(await run(`(async()=>{try{await window.desktop.copyImage('not-a-png');return false}catch{return true}})()`),true);
 assert.equal(await run(`(async()=>{try{await window.desktop.copyImage('data:image/png;base64,AAAA');return false}catch{return true}})()`),true);
 assert.deepEqual(errors,[]);console.log('PASS: copy button; full offscreen dish/history image; native IPC/PNG decoding; no edit controls; long notes/newlines; portrait/panorama photos; no-photo/no-history; duplicate-click guard; failure recovery; invalid images rejected; app data and real user clipboard unchanged');app.exit(0);
}catch(e){console.error(e.stack||e);app.exit(1)}});
