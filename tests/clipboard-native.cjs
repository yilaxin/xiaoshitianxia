const {app,BrowserWindow,clipboard,ClipboardItem,nativeImage}=require('electron');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const project=path.resolve(__dirname,'..'),profile=fs.mkdtempSync(path.join(project,'work/clipboard-native-'));
process.env.XSTX_HEADLESS_TEST='1';process.argv.push('--data-dir='+profile);require('../dist-app/main.cjs');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function snapshot(){const items=await clipboard.read(),saved=[],hashes=[];for(const item of items){const payload={};for(const type of item.types){const value=await item.getType(type);payload[type]=value;const bytes=value instanceof Blob?Buffer.from(await value.arrayBuffer()):Buffer.from(JSON.stringify(value));hashes.push(type+':'+crypto.createHash('sha256').update(bytes).digest('hex'));}saved.push(new ClipboardItem(payload));}return {saved,fingerprint:hashes.sort().join('|')};}
app.whenReady().then(async()=>{let original=null,generated=null,changed=false;try{
 assert.equal(typeof clipboard.write,'function');assert.equal(typeof clipboard.read,'function');assert.equal(typeof ClipboardItem,'function');assert.equal(typeof clipboard.writeImage,'undefined','Exercise the installed modern API without inventing the removed method');
 original=await snapshot();
 const win=BrowserWindow.getAllWindows()[0];if(win.webContents.isLoading())await new Promise(r=>win.webContents.once('did-finish-load',r));
 const run=s=>win.webContents.executeJavaScript(s,true),click=s=>run(`document.querySelector(${JSON.stringify(s)}).click()`);
 const ready=async s=>{for(let i=0;i<250;i++){if(await run(s))return;await pause(30)}throw Error('Timed out: '+s)};
 await ready(`typeof DishImage!=='undefined'`);await run(`openDish(state.dishes[0].id)`);
 assert.equal((await snapshot()).fingerprint,original.fingerprint,'Do not overwrite a newer user clipboard');
 await click('[data-action="copyDishImage"]');await ready(`!document.querySelector('[data-action="copyDishImage"]').disabled`);
 const message=await run(`document.getElementById('toast').textContent`);assert.match(message,/已复制/);
 generated=await snapshot();changed=true;
 const copied=await run(`window.desktop.readClipboardImage()`);assert.match(copied,/^data:image\/png;base64,/);const image=nativeImage.createFromDataURL(copied);assert.equal(image.getSize().width,1200);assert.ok(image.getSize().height>1200);
 const out=path.join(project,'outputs/v'+require('../package.json').version);fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'真实剪贴板-读回图片.png'),image.toPNG());
 await run(`document.getElementById('detailDialog').close();openForm()`);await click('[data-action="pastePhoto"][data-input="dishPhotos"]');await ready(`formDraft.photos.length===1`);await run(`document.getElementById('formDialog').close();FoodBooks.openRecipe()`);await click('[data-action="recipePaste"][data-target="cover"]');await ready(`!!document.querySelector('[data-recipe-photo=cover] img')`);await run(`document.getElementById('recipeDialog').close()`);
 await assert.rejects(run(`window.desktop.copyImage('invalid')`));
 console.log('PASS: installed async clipboard API; real detail button → native Windows clipboard → PNG readback at 1200px; actual photo/recipe paste buttons; invalid input rejection');
}catch(e){console.error(e.stack||e);process.exitCode=1;}finally{
 if(changed&&original&&generated){try{const current=await snapshot();if(current.fingerprint===generated.fingerprint){if(original.saved.length)await clipboard.write(original.saved);else clipboard.clear();console.log('Original clipboard contents restored.');}else console.log('Clipboard changed externally; newer user clipboard left intact.');}catch(e){console.error('Clipboard restoration failed:',e.message);process.exitCode=1;}}
 app.exit(process.exitCode||0);
}});
