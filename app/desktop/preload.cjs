'use strict';
const {contextBridge,ipcRenderer}=require('electron');
function call(channel,...args){const result=ipcRenderer.sendSync(channel,...args);if(!result?.ok)throw Error(result?.error||'操作未完成，请重试。');return result.value}
async function callAsync(channel,...args){const result=await ipcRenderer.invoke(channel,...args);if(!result?.ok)throw Error(result?.error||'操作未完成，请重试。');return result.value}
contextBridge.exposeInMainWorld('desktop',{
 copyImage:data=>callAsync('image:copy',data),
 exportBookPdf:scope=>callAsync('book:exportPdf',scope),
 version:'0.2.9',isFullscreen:()=>call('window:fullscreenState'),setBookFullscreen:enabled=>call('window:bookFullscreen',enabled),onFullscreenChange:callback=>{const listener=(_event,enabled)=>{if(typeof enabled==='boolean')callback(enabled)};ipcRenderer.on('window:fullscreenChanged',listener);return ()=>ipcRenderer.removeListener('window:fullscreenChanged',listener)},readClipboardImage:()=>callAsync('photo:clipboard'),load:()=>call('data:load'),save:state=>call('data:save',state),metadata:()=>call('data:metadata'),snapshotBeforeDelete:()=>call('data:beforeDelete'),
 exportBackup:payload=>call('backup:export',payload),prepareRestore:()=>call('backup:beforeRestore'),openData:()=>call('data:open'),openBackups:()=>call('backups:open')
});
