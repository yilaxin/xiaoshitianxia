'use strict';
// Every attempt must pass: these are repetitions, never retries on failure.
const {spawnSync}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),electron=require('electron');
const out=path.join(root,'outputs','v'+require('../package.json').version,'ci-stability');
fs.mkdirSync(out,{recursive:true});
const env={...process.env};
for(const key of ['ELECTRON_RUN_AS_NODE','XSTX_STARTUP_TEST','XSTX_STARTUP_TEST_HANG','XSTX_TEST_BUILD'])delete env[key];
const cases=[
 ['watchdog','startup-edge.cjs',['--hang-watchdog']],
 ['late-observer','startup-edge.cjs',['--hang-watchdog-delayed']],
 ['cold-frame','startup-finish.cjs',[]],
 ['recipe-readiness','food-books.cjs',[]]
];
const results=[];
for(let pass=1;pass<=3;pass++)for(const [name,file,args] of cases){
 console.log(`STABILITY ${pass}/3 ${name}`);
 const p=spawnSync(electron,[path.join(__dirname,file),...args],{cwd:root,env,encoding:'utf8',windowsHide:true,timeout:180000});
 const log=(p.stdout||'')+(p.stderr||'');process.stdout.write(log);
 fs.writeFileSync(path.join(out,`${pass}-${name}.log`),log);
 results.push({pass,name,exit:p.status,error:p.error?.message});
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));
 if(p.status!==0){console.error('Stability check failed without retry');process.exit(1);}
}
console.log('PASS: 3 consecutive passes of watchdog, late observer, cold frame, and recipe readiness');
