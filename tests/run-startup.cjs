'use strict';
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const electron=require('electron');
const root=path.resolve(__dirname,'..');
const makeEnv=extra=>{const env={...process.env,XSTX_STARTUP_TEST:'1',...extra};delete env.ELECTRON_RUN_AS_NODE;return env;};
const suites=[
 {name:'normal',file:'startup.cjs',args:[]},
 {name:'reduced',file:'startup.cjs',args:['--reduced']},
 {name:'click-and-home-transition',file:'startup-interaction.cjs',args:[]},
 {name:'cold-first-frame-completion',file:'startup-finish.cjs',args:[]},
 {name:'cover-and-margin-design',file:'startup-design.cjs',args:[]},
 {name:'escape-skip',file:'startup-edge.cjs',args:['--escape']},
 {name:'button-skip',file:'startup-edge.cjs',args:['--button']},
 {name:'waiting-escape',file:'startup-edge.cjs',args:['--hang-escape'],env:{XSTX_STARTUP_TEST_HANG:'1'}},
 {name:'waiting-watchdog',file:'startup-edge.cjs',args:['--hang-watchdog'],env:{XSTX_STARTUP_TEST_HANG:'1'}},
 {name:'small-900x650',file:'startup-edge.cjs',args:['--small']},
 {name:'reload-regression',file:'startup-reload.cjs',args:[],runner:'node'}
];
for(const suite of suites){
 console.log('\nCHECK startup '+suite.name);
 const result=spawnSync(suite.runner==='node'?process.execPath:electron,[path.join(__dirname,suite.file),...suite.args],{cwd:root,stdio:'inherit',timeout:180000,windowsHide:true,env:makeEnv(suite.env||{})});
 if(result.status!==0){
  console.error('startup '+suite.name+' failed');
  process.exit(result.status||1);
 }
}
console.log('\nPASS: startup animation contract paths and edge cases');
