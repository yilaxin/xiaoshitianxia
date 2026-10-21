'use strict';
const {spawnSync}=require('node:child_process'),path=require('node:path'),fs=require('node:fs');
const root=path.resolve(__dirname,'..'),electron=require('electron'),results=[];
const nodeTests=['data-actions','storage','recipes-storage','calendar-data','performance-storage'];
const appTests=['integration','book-turn','optional-photos','category-sort','tag-sort','favorites','hero-carousel','cover-opening','photo-paste','book-layout','book-fullscreen','meal-photos','book-wheel','food-books','calendar-journal','dish-image','clipboard-native','resource-lifecycle','book-pdf','startup'];
for(const [runtime,files] of [[process.execPath,nodeTests],[electron,appTests]])for(const name of files){
 const started=Date.now();console.log('\nCHECK '+name);
 const result=spawnSync(runtime,[path.join(__dirname,name+'.cjs')],{cwd:root,stdio:'inherit',timeout:180000,windowsHide:true,env:(()=>{const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;return env;})()});
 results.push({name,passed:result.status===0,seconds:(Date.now()-started)/1000,error:result.error?.message});
}
const out=path.join(root,'outputs/v'+require('../package.json').version);fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'regression-results.json'),JSON.stringify(results,null,2));
console.log('\n'+results.filter(x=>x.passed).length+'/'+results.length+' suites passed');
process.exit(results.every(x=>x.passed)?0:1);
