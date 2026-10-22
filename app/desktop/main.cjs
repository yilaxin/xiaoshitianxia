'use strict';
const {app,BrowserWindow,ipcMain,dialog,shell,Menu,protocol,net}=require('electron');
const {registerPhotos}=require('./photo-protocol.cjs');
const {readClipboardImage,copyImage}=require('./clipboard-images.cjs');
const {createBookPdfExporter}=require('./book-pdf.cjs');
const path=require('node:path');
const {Storage,validate}=require('./storage.cjs');
app.setName('笑食天下');
protocol.registerSchemesAsPrivileged([{scheme:'xstx-media',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true}}]);
const dataArg=process.argv.find(v=>v.startsWith('--data-dir='));
const dataRoot=dataArg?path.resolve(dataArg.slice(11)):path.join(app.getPath('appData'),'XiaoshiTianxia');
app.setPath('userData',path.join(dataRoot,'运行缓存'));
let win,storage;
const headless=process.env.XSTX_HEADLESS_TEST==='1';
const startupTest=process.env.XSTX_STARTUP_TEST==='1';
const startupEnabled=!headless||startupTest;
const startupHang=process.env.XSTX_STARTUP_TEST_HANG==='1';
const startupSession={enabled:startupEnabled,ready:false,displayed:false,played:false,pending:null,value:null,claimed:false};
function beginStartup(){if(!startupSession.enabled||!startupSession.ready||!startupSession.displayed||startupSession.played)return;startupSession.played=true;startupSession.value={startedAt:Date.now(),enabled:true};if(startupSession.pending){const resolve=startupSession.pending;startupSession.pending=null;resolve(startupSession.value);}}
const hasLock=app.requestSingleInstanceLock();
if(!hasLock)app.quit();
else{
 app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.show();win.focus()}});
 app.whenReady().then(()=>{
  try{storage=new Storage(dataRoot,{assetDir:path.join(__dirname,'assets')})}catch(e){dialog.showErrorBox('笑食天下','无法创建本机资料库：'+e.message);app.quit();return}
  registerPhotos(protocol,net,path.join(__dirname,'assets'),storage.photoDir);
  Menu.setApplicationMenu(null);
  win=new BrowserWindow({title:'笑食天下',width:1380,height:940,minWidth:900,minHeight:650,show:false,backgroundColor:'#f7f5f0',icon:path.join(__dirname,'app.ico'),autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,spellcheck:false,backgroundThrottling:process.env.XSTX_HEADLESS_TEST!=='1',offscreen:process.env.XSTX_HEADLESS_TEST==='1'}});
  const trusted=e=>e.sender===win?.webContents&&e.senderFrame===win?.webContents.mainFrame;
  function handle(channel,fn){ipcMain.on(channel,(event,...args)=>{if(!trusted(event)){event.returnValue={ok:false,error:'操作来源不受支持。'};return}try{event.returnValue={ok:true,value:fn(...args)}}catch(e){event.returnValue={ok:false,error:e.message}}})}
  function handleAsync(channel,fn){ipcMain.handle(channel,async(event,...args)=>{if(!trusted(event))return {ok:false,error:'操作来源不受支持。'};try{return {ok:true,value:await fn(...args)}}catch(e){return {ok:false,error:e.message}}})}
  handle('window:fullscreenState',()=>win.isFullScreen());
  handle('window:bookFullscreen',enabled=>{if(typeof enabled!=='boolean')throw Error('全屏状态不正确。');win.setFullScreen(enabled);return win.isFullScreen()});
  win.on('enter-full-screen',()=>win.webContents.send('window:fullscreenChanged',true));
  win.on('leave-full-screen',()=>win.webContents.send('window:fullscreenChanged',false));
  handle('startup:mode',()=>({enabled:startupSession.enabled&&!startupSession.claimed}));
  handle('startup:claim',()=>{const first=!startupSession.claimed;startupSession.claimed=true;return {first,enabled:startupSession.enabled};});
  // Keep the deliberately stalled test invocation rooted, just like the real
  // pending handshake; otherwise GC can close its native IPC reply channel.
  handleAsync('startup:ready',()=>{if(startupHang)return new Promise(resolve=>{startupSession.pending=resolve;});startupSession.claimed=true;if(!startupSession.enabled||startupSession.ready)return {startedAt:0,enabled:false};startupSession.ready=true;if(startupSession.displayed){beginStartup();return startupSession.value;}return new Promise(resolve=>{startupSession.pending=resolve;});});
  handleAsync('photo:clipboard',readClipboardImage);
  handleAsync('image:copy',copyImage);
  const exportBookPdf=createBookPdfExporter({BrowserWindow,dialog,loadState:()=>storage.loadReferences()});
  handleAsync('book:exportPdf',scope=>exportBookPdf(win,scope));
  handle('data:load',()=>storage.loadReferences());
  handle('data:save',data=>storage.save(data));
  handle('data:metadata',()=>storage.metadata());
  handle('data:beforeDelete',()=>storage.beforeDelete());
  handle('backup:beforeRestore',()=>storage.beforeRestore());
  handle('data:open',()=>{shell.openPath(storage.root);return true});
  handle('backups:open',()=>{shell.openPath(storage.backupDir);return true});
  handle('backup:export',payload=>{if(payload?.app!=='笑食天下'||payload?.format!=='prototype-1')throw Error('备份格式不正确。');validate(payload.data);const target=dialog.showSaveDialogSync(win,{title:'导出笑食天下完整备份',defaultPath:path.join(app.getPath('documents'),'笑食天下-完整备份-'+new Date().toISOString().slice(0,10)+'.json'),filters:[{name:'笑食天下备份',extensions:['json']}]});if(!target)return {canceled:true};storage.writePortable(target,payload.data,{includeSeeds:true});return {canceled:false,path:target}});
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',e=>e.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
  win.webContents.session.setPermissionCheckHandler(()=>false);
  win.webContents.on('render-process-gone',()=>dialog.showErrorBox('笑食天下','页面暂时停止运行，请关闭并重新打开。已保存的资料仍在本机。'));
  win.once('ready-to-show',()=>{if(!headless){win.show();win.focus();startupSession.displayed=true;beginStartup();}});
  if(headless&&startupTest){win.webContents.once('did-finish-load',()=>{setTimeout(()=>{startupSession.displayed=true;beginStartup();},120);});}
  win.on('closed',()=>{win=null});
  win.loadFile(path.join(__dirname,'index.html'));
 });
 app.on('window-all-closed',()=>app.quit());
}
