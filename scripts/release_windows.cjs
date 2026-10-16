'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const {packageWindows}=require('./package_windows.cjs');
const root=path.resolve(__dirname,'..'),metadata=require('../package.json');
const at=process.argv.indexOf('--arch'),requested=at>=0?process.argv[at+1]:'all';
const targets=requested==='all'?['x64','arm64']:[requested];
function run(command,args){const result=spawnSync(command,args,{cwd:root,stdio:'inherit',windowsHide:true});if(result.status!==0)throw result.error||Error(command+' failed');}
(async()=>{
 if(targets.some(a=>!['x64','arm64'].includes(a)))throw Error('Supported release architectures: x64, arm64, all.');
 run('python',['scripts/build_desktop.py']);
 const releaseDir=path.join(root,'outputs/release');fs.mkdirSync(releaseDir,{recursive:true});
 for(const arch of targets){
  const folder=await packageWindows(arch);
  for(const [source,name] of [['docs/使用说明.txt','先读我.txt'],['LICENSE','APP-LICENSE.txt'],['THIRD_PARTY_NOTICES.md','THIRD_PARTY_NOTICES.md']])fs.copyFileSync(path.join(root,source),path.join(folder,name));
  run('python',['scripts/package_zip.py','--program',folder,'--output',path.join(releaseDir,`XiaoshiTianxia-${metadata.version}-windows-${arch}.zip`),'--folder',`XiaoshiTianxia-${metadata.version}-windows-${arch}`]);
 }
 const files=fs.readdirSync(releaseDir).filter(n=>n.startsWith(`XiaoshiTianxia-${metadata.version}-windows-`)&&n.endsWith('.zip')).sort();
 const hashes=[];
 for(const name of files){const hash=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(path.join(releaseDir,name)))hash.update(chunk);hashes.push(hash.digest('hex')+'  '+name);}
 fs.writeFileSync(path.join(releaseDir,'SHA256SUMS.txt'),hashes.join('\n')+'\n');
 console.log('Release archives and SHA256SUMS.txt are ready in outputs/release');
})().catch(e=>{console.error(e.message);process.exitCode=1});
