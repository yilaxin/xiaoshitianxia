 'use strict';
const {spawnSync}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const electron=process.env.XSTX_ELECTRON||require('electron');
const work=path.join(root,'work');
fs.mkdirSync(work,{recursive:true});
const profile=fs.mkdtempSync(path.join(work,'startup-reload-'));
const seed={
 version:1,
 categories:['家常菜'],
 dishes:[{id:'reload-dish-1',name:'启动回归测试菜',category:'家常菜',tags:['测试'],favorite:false,description:'仅用于启动翻书动画回归测试',cover:'rice',created:'2026-10-15'}],
 meals:[],
 records:[{id:'reload-record-1',dishId:'reload-dish-1',mealId:null,date:'2026-10-15',note:'reload-state-marker',photos:[]}],
 lastBackup:null,
 bookIndex:2,
 preferences:{startupAnimation:false}
};
fs.writeFileSync(path.join(profile,'菜单资料.json'),JSON.stringify(seed));
const env={...process.env,XSTX_HEADLESS_TEST:'1',XSTX_STARTUP_TEST:'1'};
delete env.ELECTRON_RUN_AS_NODE;
function run(file){
 console.log('CHECK startup reload phase '+path.basename(file).replace('startup-reload-','').replace('.cjs',''));
 const result=spawnSync(electron,[file,'--data-dir='+profile],{cwd:root,stdio:'inherit',timeout:180000,windowsHide:true,env});
 if(result.status!==0){
  console.error('startup reload phase failed: '+path.basename(file));
  process.exit(result.status||1);
 }
}
run(path.join(__dirname,'startup-reload-phase1.cjs'));
run(path.join(__dirname,'startup-reload-phase2.cjs'));
console.log('PASS: startup reload regression (disabled cold start -> enable -> reload no replay; next process plays; state preserved)');
