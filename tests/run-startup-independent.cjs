// Codex integration entry: original independent author tests remain unchanged.
'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'xstx-independent-'));
const env={...process.env,NODE_PATH:process.env.NODE_PATH||path.join(root,'node_modules'),
 NODE_EXE:process.execPath,PYTHON_EXE:process.env.PYTHON_EXE||'python',
 XSTX_ELECTRON:require('electron'),XSTX_PROJECT:root,XSTX_TEST_TEMP:temp,
 PYTHONUTF8:'1',PYTHONDONTWRITEBYTECODE:'1'};
delete env.ELECTRON_RUN_AS_NODE;
const r=spawnSync(env.PYTHON_EXE,['-B','-X','utf8','-m','unittest','discover','-s','tests_independent','-p','test_*.py','-v'],
 {cwd:root,env,stdio:'inherit',windowsHide:true,timeout:600000});
console.log('Independent startup evidence: '+temp);
if(r.error)console.error(r.error.message);
process.exitCode=r.status===0?0:1;
